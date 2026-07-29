'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { RATE, TYPES, CATEGORY_SUGGESTIONS, fmtUSD, fmtLBP, toUsdLbp } from '../../lib/ledgerUtils';

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  category: '',
  where: '',
  amount: '',
  currency: 'LBP',
  notes: '',
});

const PIE_COLORS = ['#B8894C', '#B0463F', '#3F6E52', '#4C7A9E', '#8A6BA8', '#C48A3F', '#6B8F8A', '#9E6B5C'];

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = loading, null = no session
  const [isAdmin, setIsAdmin] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
      } else {
        setSession(data.session);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!sess) router.replace('/login');
      else setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();
      setIsAdmin(!!profile?.is_admin);

      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (error) setLoadError(error.message);
      else setEntries(data || []);
      setLoading(false);
    })();
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const addEntry = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setFormError('Enter an amount greater than zero.'); return; }
    if (!form.category.trim()) { setFormError('Enter a category.'); return; }
    setFormError('');
    setSaving(true);
    const { usd, lbp } = toUsdLbp(amt, form.currency);
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: session.user.id,
        entry_date: form.date,
        type: form.type,
        category: form.category.trim(),
        where_text: form.where.trim(),
        notes: form.notes.trim(),
        currency: form.currency,
        amount_raw: amt,
        usd, lbp,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { setFormError('Could not save: ' + error.message); return; }
    setEntries((prev) => [data, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
    setForm((f) => ({ ...emptyForm(), type: f.type, currency: f.currency }));
  };

  const deleteEntry = async (id) => {
    const { error } = await supabase.from('entries').delete().eq('id', id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  };

  const exportCSV = () => {
    const headers = ['date', 'type', 'category', 'where', 'amount', 'currency', 'lbp', 'usd', 'notes'];
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = entries.map((e) => [
      e.entry_date, e.type, e.category, e.where_text, e.amount_raw, e.currency,
      Math.round(e.lbp), Number(e.usd).toFixed(2), e.notes,
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, investment: 0, profit: 0 };
    entries.forEach((e) => { t[e.type] += Number(e.usd); });
    return { ...t, net: t.income + t.profit - t.expense - t.investment };
  }, [entries]);

  const expenseByCategory = useMemo(() => {
    const m = {};
    entries.filter((e) => e.type === 'expense').forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.usd); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [entries]);

  const investmentByCategory = useMemo(() => {
    const m = {};
    entries.filter((e) => e.type === 'investment').forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.usd); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [entries]);

  const monthly = useMemo(() => {
    const m = {};
    entries.forEach((e) => {
      const key = e.entry_date.slice(0, 7);
      if (!m[key]) m[key] = { month: key, income: 0, expense: 0, investment: 0, profit: 0 };
      m[key][e.type] += Number(e.usd);
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const trend = useMemo(() => {
    let running = 0;
    return monthly.map((m) => {
      const net = m.income + m.profit - m.expense - m.investment;
      running += net;
      return { month: m.month, income: m.income, expense: m.expense, net: running };
    });
  }, [monthly]);

  const visibleEntries = useMemo(
    () => (filterType === 'all' ? entries : entries.filter((e) => e.type === filterType)),
    [entries, filterType]
  );

  const monthGroups = useMemo(() => {
    const m = {};
    visibleEntries.forEach((e) => {
      const key = e.entry_date.slice(0, 7);
      if (!m[key]) m[key] = { month: key, entries: [], income: 0, expense: 0, investment: 0, profit: 0 };
      m[key].entries.push(e);
      m[key][e.type] += Number(e.usd);
    });
    return Object.values(m)
      .map((g) => ({ ...g, net: g.income + g.profit - g.expense - g.investment }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [visibleEntries]);

  const monthLabel = (key) => {
    const [y, mo] = key.split('-');
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  useEffect(() => {
    if (monthGroups.length > 0 && !monthGroups.some((g) => g.month === expandedMonth)) {
      setExpandedMonth(monthGroups[0].month);
    }
  }, [monthGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session === undefined || loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #3F6E52, #B8894C, #B0463F, #4C7A9E)' }} />
      <header style={{ borderBottom: '1px solid var(--paper-line)', padding: '26px 24px 18px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>
              Ledger No. 02
            </div>
            <h1 style={{ fontSize: 30 }}>The Running Account</h1>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--slate)', textAlign: 'right' }}>
            {session.user.email}<br />
            {isAdmin && <Link href="/admin" style={{ color: 'var(--gold)' }}>Admin view</Link>}
            {isAdmin && ' · '}
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--slate)', textDecoration: 'underline', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: 0 }}>
              Sign out
            </button>
          </div>
        </div>

        <nav style={{ maxWidth: 1080, margin: '20px auto 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            { key: 'add', label: 'Add entry' },
            { key: 'ledger', label: 'Ledger' },
            { key: 'dashboard', label: 'Dashboard' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '9px 16px', border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--ink)' : 'transparent',
              color: tab === t.key ? 'var(--paper)' : 'var(--slate)',
              fontWeight: 500, borderRadius: '3px 3px 0 0',
            }}>
              {t.label}
            </button>
          ))}
          <button onClick={exportCSV} disabled={entries.length === 0} style={{
            padding: '9px 16px', border: 'none', background: 'transparent',
            color: entries.length === 0 ? 'var(--paper-line)' : 'var(--gold)',
            fontWeight: 500, marginLeft: 'auto', cursor: entries.length === 0 ? 'default' : 'pointer',
          }}>
            Export CSV
          </button>
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 80px' }}>
        {loadError && (
          <div style={{ background: '#FBEAE8', border: '1px solid var(--coral)', color: 'var(--coral)', borderRadius: 4, padding: '12px 16px', fontSize: 13, marginBottom: 24 }}>
            Could not load your entries: {loadError}
          </div>
        )}

        {tab === 'add' && (
          <div style={{ maxWidth: 560 }}>
            <p style={{ color: 'var(--slate)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
              Log what moved today — income, a purchase, an investment, or a sale profit.
            </p>
            <form onSubmit={addEntry} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TYPES.map((t) => (
                  <button type="button" key={t.key} onClick={() => setForm((f) => ({ ...f, type: t.key, category: '' }))} style={{
                    padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                    border: `1.5px solid ${form.type === t.key ? t.color : 'var(--paper-line)'}`,
                    background: form.type === t.key ? t.color + '1a' : 'transparent',
                    color: form.type === t.key ? t.color : 'var(--slate)', fontWeight: 600, fontSize: 13,
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Date
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Category
                <input list="cat-suggestions" placeholder="e.g. Rent, Stocks, Salary" value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ marginTop: 6 }} />
                <datalist id="cat-suggestions">
                  {CATEGORY_SUGGESTIONS[form.type].map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Where / with whom
                <input placeholder="e.g. Spinneys, dispatcher, broker name" value={form.where}
                  onChange={(e) => setForm((f) => ({ ...f, where: e.target.value }))} style={{ marginTop: 6 }} />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Amount
                  <input type="number" step="any" min="0" placeholder="0" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
                <label style={{ width: 110, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Currency
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                    <option value="LBP">LBP</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Notes (optional)
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ marginTop: 6 }} />
              </label>

              {formError && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{formError}</div>}

              <button type="submit" disabled={saving} style={{
                marginTop: 8, padding: '12px 20px', border: 'none', borderRadius: 4,
                background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: saving ? 0.6 : 1,
              }}>
                {saving ? 'Saving…' : 'Add to ledger'}
              </button>
            </form>
          </div>
        )}

        {tab === 'ledger' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <p style={{ color: 'var(--slate)', fontSize: 14, margin: 0 }}>Grouped by month — tap a month to see its entries.</p>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 'auto', padding: '7px 10px', fontSize: 13 }}>
                <option value="all">All types</option>
                {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>

            {monthGroups.length === 0 ? (
              <EmptyState onAdd={() => setTab('add')} filtered={entries.length > 0} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {monthGroups.map((g) => {
                  const isOpen = expandedMonth === g.month;
                  const catMap = {};
                  g.entries.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.usd); });
                  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
                  return (
                    <div key={g.month} style={{ border: '1px solid var(--paper-line)', borderRadius: 4, overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedMonth(isOpen ? null : g.month)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 16, padding: '14px 18px', background: isOpen ? 'var(--card)' : 'transparent',
                          border: 'none', textAlign: 'left', flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 17 }}>{monthLabel(g.month)}</span>
                          <span style={{ color: 'var(--slate)', fontSize: 12 }}>{g.entries.length} {g.entries.length === 1 ? 'entry' : 'entries'}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13 }}>
                          <span style={{ color: 'var(--green)' }}>+{fmtUSD(g.income + g.profit)}</span>
                          <span style={{ color: 'var(--coral)' }}>-{fmtUSD(g.expense + g.investment)}</span>
                          <span style={{ fontWeight: 700, color: g.net >= 0 ? 'var(--green)' : 'var(--coral)' }}>{fmtUSD(g.net)}</span>
                          <span style={{ color: 'var(--slate)' }}>{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </button>

                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--paper-line)' }}>
                          {catData.length > 0 && (
                            <div style={{ padding: '16px 18px 0' }}>
                              <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name }) => name}>
                                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip formatter={(v) => fmtUSD(v)} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <div style={{ overflow: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  {['Date', 'Type', 'Category', 'Where', 'LBP', 'USD', 'Notes', ''].map((h) => <th key={h}>{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {g.entries.map((e) => {
                                  const typeInfo = TYPES.find((t) => t.key === e.type);
                                  return (
                                    <tr key={e.id}>
                                      <td>{e.entry_date}</td>
                                      <td><span style={{ color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span></td>
                                      <td>{e.category}</td>
                                      <td>{e.where_text || '—'}</td>
                                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtLBP(e.lbp)}</td>
                                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(e.usd)}</td>
                                      <td style={{ color: 'var(--slate)' }}>{e.notes || '—'}</td>
                                      <td>
                                        {confirmDeleteId === e.id ? (
                                          <span style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => deleteEntry(e.id)} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 11 }}>Delete</button>
                                            <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>×</button>
                                          </span>
                                        ) : (
                                          <button onClick={() => setConfirmDeleteId(e.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>Delete</button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'dashboard' && (
          entries.length === 0 ? <EmptyState onAdd={() => setTab('add')} /> : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 32 }}>
              <KpiCard label="Income" value={fmtUSD(totals.income)} color="var(--green)" />
              <KpiCard label="Expenses" value={fmtUSD(totals.expense)} color="var(--coral)" />
              <KpiCard label="Invested" value={fmtUSD(totals.investment)} color="var(--gold)" />
              <KpiCard label="Sale profit" value={fmtUSD(totals.profit)} color="var(--blue)" />
              <KpiCard label="Net position" value={fmtUSD(totals.net)} color={totals.net >= 0 ? 'var(--green)' : 'var(--coral)'} bold />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <ChartCard title="Expenses by category">
                {expenseByCategory.length === 0 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name }) => name}>
                        {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard title="Investments by category">
                {investmentByCategory.length === 0 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={investmentByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name }) => name}>
                        {investmentByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard title="Monthly flow">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => fmtUSD(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#3F6E52" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#B0463F" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="investment" name="Investment" fill="#B8894C" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="profit" name="Sale profit" fill="#4C7A9E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
              <ChartCard title="Net position over time">
                {trend.length < 2 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                      <Line type="monotone" dataKey="net" name="Net position" stroke="#B8894C" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard title="Income vs. expenses trend">
                {trend.length < 2 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="income" name="Income" stroke="#3F6E52" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="expense" name="Expense" stroke="#B0463F" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </div>
          )
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value, color, bold }) {
  return (
    <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, padding: 16, background: 'var(--card)' }}>
      <div style={{ color: 'var(--slate)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Source Serif 4', serif", fontWeight: bold ? 700 : 600, fontSize: 22, color }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, padding: 18, background: 'var(--card)' }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function NoData() {
  return <div style={{ color: 'var(--slate)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Nothing here yet.</div>;
}

function EmptyState({ onAdd, filtered }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--paper-line)', borderRadius: 4 }}>
      <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 16 }}>
        {filtered ? 'No entries match this filter.' : 'No entries yet. The ledger starts with your first one.'}
      </p>
      {!filtered && (
        <button onClick={onAdd} style={{ padding: '10px 18px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600 }}>
          Add your first entry
        </button>
      )}
    </div>
  );
}
