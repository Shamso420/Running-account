'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { TYPES, fmtUSD, fmtLBP } from '../../lib/ledgerUtils';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [entries, setEntries] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', sessionData.session.user.id)
        .single();

      if (!profile?.is_admin) {
        // Not an admin — RLS would block the data anyway, but redirect for a clean UX.
        router.replace('/dashboard');
        return;
      }
      setAllowed(true);

      const [entriesRes, profilesRes] = await Promise.all([
        supabase.from('entries').select('*').order('entry_date', { ascending: false }),
        supabase.from('profiles').select('id, email'),
      ]);
      if (entriesRes.error) setError(entriesRes.error.message);
      setEntries(entriesRes.data || []);
      setProfiles(profilesRes.data || []);
      setLoading(false);
    })();
  }, [router]);

  const emailFor = (userId) => profiles.find((p) => p.id === userId)?.email || userId;

  const byUser = useMemo(() => {
    const m = {};
    entries.forEach((e) => {
      const key = e.user_id;
      if (!m[key]) m[key] = { income: 0, expense: 0, investment: 0, profit: 0, debtOwedToMe: 0, debtIOwe: 0, count: 0 };
      if (e.type === 'debt') {
        if (e.status !== 'settled') {
          if (e.debt_direction === 'i_owe') m[key].debtIOwe += Number(e.usd);
          else m[key].debtOwedToMe += Number(e.usd);
        }
      } else {
        m[key][e.type] += Number(e.usd);
      }
      m[key].count += 1;
    });
    return Object.entries(m).map(([userId, t]) => {
      const netDebt = t.debtOwedToMe - t.debtIOwe;
      return {
        userId,
        email: emailFor(userId),
        ...t,
        netDebt,
        net: t.income + t.profit - t.expense - t.investment + netDebt,
      };
    });
  }, [entries, profiles]);

  if (loading || !allowed) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #3F6E52, #B8894C, #B0463F, #4C7A9E)' }} />
      <header style={{ borderBottom: '1px solid var(--paper-line)', padding: '26px 24px 18px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>
              Admin
            </div>
            <h1 style={{ fontSize: 28 }}>All accounts</h1>
          </div>
          <Link href="/dashboard" style={{ color: 'var(--slate)', fontSize: 13 }}>&larr; Back to your ledger</Link>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 80px' }}>
        {error && (
          <div style={{ background: '#FBEAE8', border: '1px solid var(--coral)', color: 'var(--coral)', borderRadius: 4, padding: '12px 16px', fontSize: 13, marginBottom: 24 }}>
            {error}
          </div>
        )}

        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Summary by user</h3>
        <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, overflow: 'auto', marginBottom: 36 }}>
          <table>
            <thead>
              <tr>
                {['User', 'Entries', 'Income', 'Expenses', 'Invested', 'Sale profit', 'Debt (net)', 'Net'].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {byUser.map((u) => (
                <tr key={u.userId}>
                  <td>{u.email}</td>
                  <td>{u.count}</td>
                  <td style={{ color: 'var(--green)' }}>{fmtUSD(u.income)}</td>
                  <td style={{ color: 'var(--coral)' }}>{fmtUSD(u.expense)}</td>
                  <td style={{ color: 'var(--gold)' }}>{fmtUSD(u.investment)}</td>
                  <td style={{ color: 'var(--blue)' }}>{fmtUSD(u.profit)}</td>
                  <td style={{ color: u.netDebt >= 0 ? 'var(--green)' : 'var(--coral)' }}>{fmtUSD(u.netDebt)}</td>
                  <td style={{ fontWeight: 600, color: u.net >= 0 ? 'var(--green)' : 'var(--coral)' }}>{fmtUSD(u.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Every entry, all users</h3>
        <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                {['User', 'Date', 'Type', 'Category', 'Where', 'LBP', 'USD', 'Notes'].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const typeInfo = TYPES.find((t) => t.key === e.type);
                return (
                  <tr key={e.id}>
                    <td>{emailFor(e.user_id)}</td>
                    <td>{e.entry_date}</td>
                    <td><span style={{ color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span></td>
                    <td>{e.category}</td>
                    <td>{e.where_text || '—'}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtLBP(e.lbp)}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(e.usd)}</td>
                    <td style={{ color: 'var(--slate)' }}>{e.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
