
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
  const [editingEmail, setEditingEmail] = useState(null);
  const [acctForm, setAcctForm] = useState({ plan: 'free', useRoles: false, adminPin: '', entryPin: '', viewerPin: '' });
  const [acctSaving, setAcctSaving] = useState(false);
  const [acctError, setAcctError] = useState('');
  const [acctSuccess, setAcctSuccess] = useState('');

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
        supabase.from('profiles').select('id, email, plan, use_roles'),
      ]);
      if (entriesRes.error) setError(entriesRes.error.message);
      setEntries(entriesRes.data || []);
      setProfiles(profilesRes.data || []);
      setLoading(false);
    })();
  }, [router]);

  const emailFor = (userId) => profiles.find((p) => p.id === userId)?.email || userId;

  const openAcctEdit = (profile) => {
    setEditingEmail(profile.email);
    setAcctForm({ plan: profile.plan || 'free', useRoles: !!profile.use_roles, adminPin: '', entryPin: '', viewerPin: '' });
    setAcctError('');
    setAcctSuccess('');
  };

  const closeAcctEdit = () => {
    setEditingEmail(null);
    setAcctError('');
    setAcctSuccess('');
  };

  const saveAcctEdit = async () => {
    setAcctSaving(true);
    setAcctError('');
    setAcctSuccess('');

    const { error: planErr } = await supabase.rpc('admin_set_plan', {
      p_email: editingEmail,
      p_plan: acctForm.plan,
      p_use_roles: acctForm.useRoles,
    });
    if (planErr) { setAcctSaving(false); setAcctError('Could not update plan: ' + planErr.message); return; }

    const pinUpdates = [
      { role: 'admin', pin: acctForm.adminPin },
      { role: 'entry', pin: acctForm.entryPin },
      { role: 'viewer', pin: acctForm.viewerPin },
    ].filter((p) => p.pin.trim());

    for (const p of pinUpdates) {
      const { error: pinErr } = await supabase.rpc('admin_set_role_pin', {
        p_email: editingEmail,
        p_role: p.role,
        p_pin: p.pin.trim(),
      });
      if (pinErr) { setAcctSaving(false); setAcctError(`Could not set ${p.role} PIN: ` + pinErr.message); return; }
    }

    setProfiles((prev) => prev.map((pr) => (
      pr.email === editingEmail ? { ...pr, plan: acctForm.plan, use_roles: acctForm.useRoles } : pr
    )));
    setAcctSaving(false);
    setAcctSuccess('Saved.');
  };

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

        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Manage accounts</h3>
        <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Upgrade any account to business plan and set its role PINs — applies immediately, no SQL needed.
        </p>
        <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, overflow: 'auto', marginBottom: 36 }}>
          <table>
            <thead>
              <tr>
                {['Email', 'Plan', 'Roles', ''].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.plan || 'free'}</td>
                  <td>{p.use_roles ? 'On' : 'Off'}</td>
                  <td>
                    <button onClick={() => openAcctEdit(p)} style={{ background: 'none', border: '1px solid var(--paper-line)', color: 'var(--ink)', borderRadius: 3, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

      {editingEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,57,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', borderRadius: '8px 8px 0 0', padding: '22px 22px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>Manage {editingEmail}</h3>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
              Changes apply as soon as you save.
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, marginBottom: 6 }}>Plan</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['free', 'business'].map((p) => (
                  <button key={p} onClick={() => setAcctForm((f) => ({ ...f, plan: p }))} style={{
                    flex: 1, padding: '9px 12px', borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize',
                    border: `1.5px solid ${acctForm.plan === p ? 'var(--gold)' : 'var(--paper-line)'}`,
                    background: acctForm.plan === p ? 'var(--gold)1a' : 'transparent',
                    color: acctForm.plan === p ? 'var(--gold)' : 'var(--slate)', fontWeight: 600, fontSize: 13,
                  }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--slate)', border: '1px solid var(--paper-line)', borderRadius: 4, padding: '10px 12px', cursor: 'pointer', marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={acctForm.useRoles}
                onChange={(e) => setAcctForm((f) => ({ ...f, useRoles: e.target.checked }))}
                style={{ width: 'auto' }}
              />
              <span>Enable shared-login roles (Admin / Entry / Viewer PIN gate)</span>
            </label>

            {acctForm.useRoles && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--slate)', margin: 0 }}>Only fill in a PIN to set or change it — leave blank to keep as-is.</p>
                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Admin PIN
                  <input type="text" inputMode="numeric" placeholder="e.g. 1111" value={acctForm.adminPin}
                    onChange={(e) => setAcctForm((f) => ({ ...f, adminPin: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Data entry PIN
                  <input type="text" inputMode="numeric" placeholder="e.g. 2222" value={acctForm.entryPin}
                    onChange={(e) => setAcctForm((f) => ({ ...f, entryPin: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Viewer PIN
                  <input type="text" inputMode="numeric" placeholder="e.g. 3333" value={acctForm.viewerPin}
                    onChange={(e) => setAcctForm((f) => ({ ...f, viewerPin: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
              </div>
            )}

            {acctError && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 12 }}>{acctError}</div>}
            {acctSuccess && <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12 }}>{acctSuccess}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeAcctEdit} style={{ flex: 1, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4, background: 'transparent', color: 'var(--slate)', fontWeight: 600 }}>
                Close
              </button>
              <button onClick={saveAcctEdit} disabled={acctSaving} style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: acctSaving ? 0.6 : 1 }}>
                {acctSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
