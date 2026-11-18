'use client';

import { useState } from 'react';
import Link from 'next/link';

const ICON_FOR = {
  add: 'add', ledger: 'ledger', dashboard: 'dashboard', daily: 'daily', monthly: 'monthly', goals: 'goals',
  costs: 'costs', wages: 'wages', debts: 'debts', partnerDebts: 'partnerDebts', inventory: 'inventory', journal: 'journal',
};

export function NavIcon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'add': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
    case 'ledger': return <svg {...common}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M9 8h6M9 12h6" /></svg>;
    case 'reports': return <svg {...common}><path d="M5 20V11M12 20V5M19 20v-9" /></svg>;
    case 'money': return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1" /></svg>;
    case 'dashboard': return <svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="4" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="14" width="7" height="6" rx="1.5" /></svg>;
    case 'daily': return <svg {...common}><path d="M7 3h8l4 4v14H7V3z" /><path d="M15 3v4h4M10 12h6M10 16h6" /></svg>;
    case 'monthly': return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>;
    case 'goals': return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
    case 'costs': return <svg {...common}><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1" /></svg>;
    case 'wages': return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 5a3.5 3.5 0 0 1 0 7M21 20c0-2.5-1.5-4.5-4-5.5" /></svg>;
    case 'debts': return <svg {...common}><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" /></svg>;
    case 'partnerDebts': return <svg {...common}><path d="M8 12h8M5 8a4 4 0 1 0 0 8M19 8a4 4 0 1 1 0 8" /></svg>;
    case 'inventory': return <svg {...common}><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>;
    case 'journal': return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>;
    case 'export': return <svg {...common}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;
    case 'admin': return <svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>;
    case 'role': return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>;
    case 'signout': return <svg {...common}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" /></svg>;
    case 'chevron': return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
    default: return null;
  }
}

function RailItem({ icon, label, active, expanded, onClick, href, chevron, open, color, disabled }) {
  const style = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 40, padding: '0 0 0 8px',
    border: 'none', borderRadius: 20, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', flexShrink: 0,
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--paper)' : color || 'var(--slate)',
    fontWeight: 500, fontSize: 14,
  };
  const inner = (
    <>
      <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <NavIcon name={icon} />
      </span>
      {expanded && <span style={{ flex: 1 }}>{label}</span>}
      {expanded && chevron && (
        <span style={{ marginRight: 12, display: 'flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <NavIcon name="chevron" size={16} />
        </span>
      )}
    </>
  );
  const title = expanded ? undefined : label;
  if (href) {
    return <Link href={href} title={title} aria-label={label} style={style}>{inner}</Link>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={label}
      aria-expanded={chevron ? !!open : undefined} style={style}>
      {inner}
    </button>
  );
}

export default function SideRail({
  tab, setTab, addLedgerTabs, reportsTabs, moneyTabs, otherTabs,
  email, plan, useRoles, role, isAdmin, onSwitchRole, onSignOut, onExport, exportDisabled, onAdd,
}) {
  const [expanded, setExpanded] = useState(false);
  const [group, setGroup] = useState(null);

  const groups = [
    { key: 'reports', label: 'Reports', icon: 'reports', items: reportsTabs },
    { key: 'money', label: 'Money', icon: 'money', items: moneyTabs },
  ];
  const groupOf = (key) => groups.find((g) => g.items.some((i) => i.key === key))?.key ?? null;

  const expand = () => { setExpanded(true); setGroup((g) => g ?? groupOf(tab)); };
  const collapse = () => setExpanded(false);
  const go = (key) => { if (key === 'add') onAdd(); setTab(key); };

  return (
    <aside className="dash-sidebar" style={{ width: 88, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', zIndex: 30 }}>
      <nav
        aria-label="Main"
        onMouseEnter={expand}
        onMouseLeave={collapse}
        onFocus={expand}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) collapse(); }}
        style={{
          position: 'absolute', top: 16, bottom: 16, left: 16, width: expanded ? 236 : 56, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', padding: '12px 7px', overflow: 'hidden',
          background: 'var(--card)', border: '1px solid var(--paper-line)', borderRadius: 28,
          boxShadow: expanded ? '0 12px 40px rgba(0,0,0,0.45)' : 'none',
          transition: 'width 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, paddingLeft: 3, flexShrink: 0 }}>
          <img src="/logo.png" alt="Running Account" style={{ height: 32, width: 32, borderRadius: 8, flexShrink: 0 }} />
          {expanded && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--gold)', textTransform: 'uppercase' }}>Ledger No. 02</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>Running Account</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {addLedgerTabs.map((t) => (
            <RailItem key={t.key} icon={ICON_FOR[t.key]} label={t.label} active={tab === t.key} expanded={expanded} onClick={() => go(t.key)} />
          ))}

          {groups.map((g) => {
            const hasActive = g.items.some((i) => i.key === tab);
            const open = expanded && group === g.key;
            return (
              <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <RailItem
                  icon={g.icon} label={g.label} chevron open={open} expanded={expanded}
                  active={hasActive && !open}
                  onClick={() => { if (!expanded) { setExpanded(true); setGroup(g.key); } else setGroup(open ? null : g.key); }}
                />
                {open && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '2px 0 6px' }}>
                    {g.items.map((t) => (
                      <button key={t.key} type="button" onClick={() => go(t.key)} style={{
                        height: 34, padding: '0 14px 0 44px', borderRadius: 17, textAlign: 'left', whiteSpace: 'nowrap',
                        cursor: 'pointer', fontWeight: 500, fontSize: 13.5,
                        border: `1px solid ${tab === t.key ? 'var(--paper-line)' : 'transparent'}`,
                        background: tab === t.key ? 'var(--paper)' : 'transparent',
                        color: tab === t.key ? 'var(--ink)' : 'var(--slate)',
                      }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ height: 1, background: 'var(--paper-line)', margin: '6px 8px', flexShrink: 0 }} />

          {otherTabs.map((t) => (
            <RailItem key={t.key} icon={ICON_FOR[t.key]} label={t.label} active={tab === t.key} expanded={expanded} onClick={() => go(t.key)} />
          ))}
          <RailItem icon="export" label="Export CSV" expanded={expanded} onClick={onExport} disabled={exportDisabled}
            color={exportDisabled ? 'var(--paper-line)' : 'var(--gold)'} />
        </div>

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--paper-line)', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <div title={expanded ? undefined : email} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, paddingLeft: 4, overflow: 'hidden' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--paper)', border: '1px solid var(--paper-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--gold)',
            }}>
              {(email || '?')[0].toUpperCase()}
            </div>
            {expanded && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
                <div style={{ fontSize: 11, color: 'var(--slate)', textTransform: 'capitalize' }}>{plan} plan{useRoles && role ? ` · ${role}` : ''}</div>
              </div>
            )}
          </div>
          {isAdmin && <RailItem href="/admin" icon="admin" label="Admin view" expanded={expanded} color="var(--gold)" />}
          {useRoles && <RailItem icon="role" label="Switch role" expanded={expanded} onClick={onSwitchRole} />}
          <RailItem icon="signout" label="Sign out" expanded={expanded} onClick={onSignOut} />
        </div>
      </nav>
    </aside>
  );
}
