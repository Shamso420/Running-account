'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Phone navigation: a dark menu pill on the left, the account avatar on the right.
// Each opens a sheet. `variant="hero"` sits on the home screen's gradient header;
// `variant="plain"` is the bar shown above every other tab.

const pillBase = {
  border: '1px solid var(--paper-line)', cursor: 'pointer', color: 'var(--ink)', background: 'var(--paper)',
  height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--slate)', padding: '14px 14px 6px' }}>
      {children}
    </div>
  );
}

function SheetItem({ active, onClick, children, disabled, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderRadius: 12,
        background: active ? 'var(--ink)' : 'transparent',
        color: disabled ? 'var(--paper-line)' : active ? 'var(--paper)' : tone || 'var(--ink)',
        fontSize: 15, fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export default function MobileNav({
  variant = 'plain', tab, setTab, addLedgerTabs, reportsTabs, moneyTabs, otherTabs,
  email, username, onEditUsername, isAdmin, useRoles, onSwitchRole, onSignOut, onExport, exportDisabled, onAdd,
}) {
  const [open, setOpen] = useState(null); // null | 'menu' | 'account'

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const allTabs = [...addLedgerTabs, ...reportsTabs, ...moneyTabs, ...otherTabs];
  const currentLabel = allTabs.find((t) => t.key === tab)?.label || '';
  const initial = (username || email || '?').trim().charAt(0).toUpperCase();

  const go = (key) => {
    if (key === 'add') onAdd();
    setTab(key);
    setOpen(null);
  };

  const renderTabs = (tabs) => tabs.map((t) => (
    <SheetItem key={t.key} active={tab === t.key} onClick={() => go(t.key)}>{t.label}</SheetItem>
  ));

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          aria-label={open === 'menu' ? 'Close menu' : 'Open menu'}
          aria-expanded={open === 'menu'}
          onClick={() => setOpen(open === 'menu' ? null : 'menu')}
          style={{ ...pillBase, width: 64, borderRadius: 22 }}
        >
          {open === 'menu' ? <CloseIcon /> : <MenuIcon />}
        </button>

        {variant === 'plain' && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="" style={{ height: 26, width: 26, borderRadius: 6, flexShrink: 0 }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentLabel || 'Running Account'}
            </span>
          </div>
        )}
        {variant === 'hero' && <div style={{ flex: 1 }} />}

        <button
          type="button"
          aria-label="Account"
          aria-expanded={open === 'account'}
          onClick={() => setOpen(open === 'account' ? null : 'account')}
          style={{ ...pillBase, width: 44, borderRadius: 22, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--gold)', borderColor: 'var(--gold)' }}
        >
          {initial}
        </button>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)' }} />
          {open === 'menu' && (
            <div style={{
              position: 'absolute', top: 54, left: 0, right: 0, zIndex: 41, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
              background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--paper-line)', borderRadius: 22, padding: 8,
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
            }}>
              {renderTabs(addLedgerTabs)}
              <SectionLabel>Reports</SectionLabel>
              {renderTabs(reportsTabs)}
              <SectionLabel>Money</SectionLabel>
              {renderTabs(moneyTabs)}
              <SectionLabel>More</SectionLabel>
              {renderTabs(otherTabs)}
              <SheetItem disabled={exportDisabled} tone="var(--gold)" onClick={() => { onExport(); setOpen(null); }}>Export CSV</SheetItem>
            </div>
          )}
          {open === 'account' && (
            <div style={{
              position: 'absolute', top: 54, right: 0, zIndex: 41, width: 'min(300px, 100%)',
              background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--paper-line)', borderRadius: 22, padding: 8,
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
            }}>
              <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--paper-line)', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Signed in as</div>
                {username && <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{username}</div>}
                <div style={{ fontSize: username ? 12 : 14, color: username ? 'var(--slate)' : 'var(--ink)', marginTop: username ? 2 : 4, wordBreak: 'break-all' }}>{email}</div>
              </div>
              <SheetItem onClick={() => { setOpen(null); onEditUsername(); }}>{username ? 'Change username' : 'Set username'}</SheetItem>
              {isAdmin && (
                <Link href="/admin" onClick={() => setOpen(null)} style={{ display: 'block', padding: '12px 14px', color: 'var(--gold)', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
                  Admin view
                </Link>
              )}
              {useRoles && <SheetItem onClick={() => { onSwitchRole(); setOpen(null); }}>Switch role</SheetItem>}
              <SheetItem tone="var(--coral)" onClick={() => { setOpen(null); onSignOut(); }}>Sign out</SheetItem>
            </div>
          )}
        </>
      )}
    </div>
  );
}
