'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmtUSD } from '../lib/ledgerUtils';
import { PIE_COLORS, CHART_TICK, CHART_TOOLTIP_PROPS, CHART_LEGEND_STYLE } from '../lib/chartStyle';

function HudRing({ label, value, color, deg, icon }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="hud-ring" style={{ '--ring-c': color, '--ring-deg': `${deg}deg` }}>
        <span className="hud-ring-dot" style={{ background: color, boxShadow: `0 0 6px 1px ${color}` }} />
        <span className="hud-ring-icon" style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color }}>{value}</div>
    </div>
  );
}

function DashCard({ title, action, children }) {
  return (
    <div style={{ border: '1px solid var(--paper-line)', borderRadius: 14, padding: 18, background: 'var(--card)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function ViewAll({ onClick, label = 'View all' }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function Empty({ children = 'Nothing here yet.' }) {
  return <div style={{ color: 'var(--slate)', fontSize: 13, padding: '36px 0', textAlign: 'center' }}>{children}</div>;
}

function DonutCard({ title, data, offset = 0 }) {
  const top = data.slice(0, 5);
  return (
    <DashCard title={title}>
      {data.length === 0 ? <Empty /> : (
        <>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="none">
                  {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + offset) % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtUSD(v)} {...CHART_TOOLTIP_PROPS} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top.map((d, i) => (
              <li key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: PIE_COLORS[(i + offset) % PIE_COLORS.length], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{d.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--slate)' }}>{fmtUSD(d.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashCard>
  );
}

const pill = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20,
  border: '1px solid var(--paper-line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500,
};

export default function DashboardHome({
  totals, monthly, trend, expenseByCategory, investmentByCategory,
  recent, actions, actionTotal, onNavigate, onExport,
}) {
  const kpiVals = [totals.income, totals.expense, totals.investment, totals.sale, totals.netDebt, totals.net].map((v) => Math.abs(Number(v)));
  const maxAbs = Math.max(1, ...kpiVals);
  const ringDeg = (v) => 30 + Math.min(1, Math.abs(Number(v)) / maxAbs) * 300;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 26, margin: 0 }}>Dashboard</h2>
          <p style={{ color: 'var(--slate)', fontSize: 13, margin: '4px 0 0' }}>A clear view of where your money moves.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={pill}>All time</span>
          <button type="button" onClick={onExport} style={{ ...pill, cursor: 'pointer' }}>Export</button>
        </div>
      </div>

      <div className="hud-frame" style={{ border: '1px solid var(--paper-line)', borderRadius: 14, background: 'var(--card)', padding: '20px 16px', marginBottom: 20 }}>
        <span className="hud-c2" />
        <div className="hud-sweep" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, position: 'relative', zIndex: 1 }}>
          <HudRing label="Income" value={fmtUSD(totals.income)} color="var(--green)" deg={ringDeg(totals.income)} icon="USD" />
          <HudRing label="Expenses" value={fmtUSD(totals.expense)} color="var(--coral)" deg={ringDeg(totals.expense)} icon="USD" />
          <HudRing label="Invested" value={fmtUSD(totals.investment)} color="var(--gold)" deg={ringDeg(totals.investment)} icon="USD" />
          <HudRing label="Sale profit" value={fmtUSD(totals.sale)} color="var(--blue)" deg={ringDeg(totals.sale)} icon="USD" />
          <HudRing label="Debt (net)" value={fmtUSD(totals.netDebt)} color={totals.netDebt >= 0 ? 'var(--green)' : 'var(--coral)'} deg={ringDeg(totals.netDebt)} icon="NET" />
          <HudRing label="Net position" value={fmtUSD(totals.net)} color={totals.net >= 0 ? 'var(--green)' : 'var(--coral)'} deg={ringDeg(totals.net)} icon="NET" />
        </div>
      </div>

      <div className="dash-row-wide">
        <DashCard title="Cash flows">
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtUSD(v)} cursor={{ fill: 'rgba(255,255,255,0.04)' }} {...CHART_TOOLTIP_PROPS} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              <Bar dataKey="income" name="Income" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="expense" name="Expense" fill="#FF5C7A" radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="investment" name="Investment" fill="#F0B429" radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="sale" name="Sale profit" fill="#2DE2E6" radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </DashCard>
        <DonutCard title="Top categories" data={expenseByCategory} />
      </div>

      <div className="dash-row-3">
        <DashCard title="Last transactions" action={<ViewAll onClick={() => onNavigate('ledger')} />}>
          {recent.length === 0 ? <Empty /> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {recent.map((r) => (
                <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--paper-line)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--slate)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: r.sign > 0 ? 'var(--green)' : 'var(--coral)', whiteSpace: 'nowrap' }}>
                    {r.sign > 0 ? '+' : '−'}{fmtUSD(Math.abs(r.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashCard>

        <DashCard title="Action required" action={actionTotal > 0 ? <ViewAll onClick={() => onNavigate('debts')} label={`View all (${actionTotal})`} /> : null}>
          {actions.length === 0 ? <Empty>Nothing overdue. You&apos;re all caught up.</Empty> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {actions.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onNavigate('debts')} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', borderTop: '1px solid var(--paper-line)',
                    background: 'transparent', textAlign: 'left', cursor: 'pointer',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.who}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--coral)' }}>Overdue · {a.days}d</div>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{fmtUSD(a.balance)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DashCard>

        <DashCard title="Net position over time">
          {trend.length < 2 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
                <XAxis dataKey="month" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmtUSD(v)} {...CHART_TOOLTIP_PROPS} />
                <Line type="monotone" dataKey="net" name="Net position" stroke="#F0B429" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </DashCard>
      </div>

      <div className="dash-row-2">
        <DonutCard title="Investments by category" data={investmentByCategory} offset={3} />
        <DashCard title="Income vs. expenses trend">
          {trend.length < 2 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
                <XAxis dataKey="month" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmtUSD(v)} {...CHART_TOOLTIP_PROPS} />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#34D399" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expense" name="Expense" stroke="#FF5C7A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </DashCard>
      </div>
    </div>
  );
}
