'use client';

import { fmtUSD } from '../lib/ledgerUtils';
import { PIE_COLORS } from '../lib/chartStyle';

// Phone home screen: gradient header with the greeting and net position, this
// month's income and expenses, quick actions, and a one-glance spending report.
// The desktop dashboard (DashboardHome) keeps the full charts.

const REPORT_COLORS = PIE_COLORS.slice(0, 5);

function greetingName(email) {
  const first = String(email || '').split('@')[0].split(/[._\-+]/)[0].replace(/\d+$/, '');
  if (!first) return 'there';
  const name = first.charAt(0).toUpperCase() + first.slice(1);
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

const ICON_COLOR = { minus: 'var(--coral)', plus: 'var(--green)', check: 'var(--blue)' };

function ActionIcon({ kind }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (kind === 'minus') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>;
  if (kind === 'plus') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></svg>;
}

function Card({ title, action, children, style }) {
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--paper-line)', borderRadius: 24, padding: '18px 18px', ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 500, margin: 0 }}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Tile({ icon, kicker, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative', minHeight: 104, padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
        background: 'var(--card)', border: '1px solid var(--paper-line)', borderRadius: 22, color: 'var(--ink)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 0,
      }}
    >
      <span style={{ position: 'absolute', top: 12, right: 12, display: 'flex', color: ICON_COLOR[icon] }}><ActionIcon kind={icon} /></span>
      <span style={{ fontSize: 10, color: 'var(--slate)' }}>{kicker}</span>
      <span style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

export default function MobileHome({
  topBar, email, totals, monthly, expenseByCategory, recent, actions, actionTotal,
  canAdd, onAdd, onNavigate,
}) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const m = monthly.find((x) => x.month === thisMonth) || { income: 0, expense: 0 };

  // Top four spending categories, everything else folded into "Others".
  const total = expenseByCategory.reduce((s, c) => s + c.value, 0);
  const head = expenseByCategory.slice(0, 4);
  const rest = expenseByCategory.slice(4).reduce((s, c) => s + c.value, 0);
  const report = [...head, ...(rest > 0 ? [{ name: 'Others', value: rest }] : [])]
    .map((c, i) => ({ ...c, pct: total > 0 ? (c.value / total) * 100 : 0, color: REPORT_COLORS[i] }));

  const net = Number(totals.net);

  return (
    // The page's <main> pads its content; this pulls the header out to the screen edges.
    <div style={{ margin: '-28px -24px 0' }}>
      <div style={{
        background: 'radial-gradient(120% 90% at 100% 0%, rgba(45,226,230,0.22) 0%, transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(240,180,41,0.14) 0%, transparent 60%), var(--card)',
        borderBottom: '1px solid var(--paper-line)', borderRadius: '0 0 36px 36px', padding: '18px 16px 18px', color: 'var(--ink)',
      }}>
        {topBar}
        <div style={{ margin: '22px 4px 18px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 300, lineHeight: 1.1 }}>Welcome</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{greetingName(email)}!</div>
        </div>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-line)', borderRadius: 22, padding: '16px 20px 18px', minHeight: 104, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)' }}>Net position</span>
          <span style={{ alignSelf: 'flex-end', fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 600, color: net < 0 ? 'var(--coral)' : 'var(--green)' }}>
            {fmtUSD(net)}
          </span>
        </div>
      </div>

      <div style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ padding: '6px 18px' }}>
          {[
            { label: 'Income this month', value: m.income },
            { label: 'Expenses this month', value: m.expense },
          ].map((row, i) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '13px 0', borderTop: i ? '1px solid var(--paper-line)' : 'none' }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{row.label}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600 }}>{fmtUSD(row.value)}</span>
            </div>
          ))}
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${canAdd ? 3 : 1}, minmax(0, 1fr))`, gap: 10 }}>
          {canAdd && <Tile icon="minus" kicker="Add" label="Expense" onClick={() => onAdd('expense')} />}
          {canAdd && <Tile icon="plus" kicker="Add" label="Income" onClick={() => onAdd('income')} />}
          <Tile icon="check" kicker="View" label="Ledger" onClick={() => onNavigate('ledger')} />
        </div>

        <Card title="Financial report">
          {report.length === 0 ? (
            <div style={{ color: 'var(--slate)', fontSize: 13, padding: '18px 0', textAlign: 'center' }}>No expenses yet.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${report.length}, minmax(0, 1fr))`, gap: 8 }}>
                {report.map((c) => (
                  <div key={c.name} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--slate)', marginBottom: 6 }}>{Math.round(c.pct)}%</div>
                    <div style={{ height: 96, background: 'var(--paper)', borderRadius: 14, display: 'flex', alignItems: 'flex-end', padding: '0 0 0 0', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: `${Math.max(5, c.pct)}%`, background: c.color, borderRadius: '14px 14px 0 0' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 16 }}>
                {report.map((c) => (
                  <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink)', maxWidth: '100%' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card
          title="Last transactions"
          action={recent.length > 0 && (
            <button type="button" onClick={() => onNavigate('ledger')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View all</button>
          )}
        >
          {recent.length === 0 ? (
            <div style={{ color: 'var(--slate)', fontSize: 13, padding: '18px 0', textAlign: 'center' }}>Nothing here yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {recent.map((r, i) => (
                <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--paper-line)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--slate)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: r.sign > 0 ? 'var(--green)' : 'var(--coral)', whiteSpace: 'nowrap' }}>
                    {r.sign > 0 ? '+' : '−'}{fmtUSD(Math.abs(r.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {actions.length > 0 && (
          <Card
            title="Action required"
            action={<button type="button" onClick={() => onNavigate('debts')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{`View all (${actionTotal})`}</button>}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {actions.map((a, i) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onNavigate('debts')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 0', border: 'none', borderTop: i ? '1px solid var(--paper-line)' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.who}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--coral)' }}>Overdue · {a.days}d</div>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>{fmtUSD(a.balance)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
