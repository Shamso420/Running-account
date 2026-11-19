'use client';

import { useEffect, useState } from 'react';
import { USERNAME_MAX, validateUsername } from '../lib/username';

// Small modal for choosing or changing the display name.
// onSave(name) resolves to an error message, or '' on success.
export default function UsernameDialog({ initial, onSave, onClose }) {
  const [value, setValue] = useState(initial || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateUsername(value);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    const err = await onSave(value.trim());
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-label="Username"
        style={{ position: 'relative', width: '100%', maxWidth: 360, background: 'var(--card)', border: '1px solid var(--paper-line)', borderRadius: 20, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
      >
        <h3 style={{ fontSize: 18, margin: '0 0 6px' }}>Your username</h3>
        <p style={{ color: 'var(--slate)', fontSize: 13, margin: '0 0 16px' }}>
          Shown in the greeting instead of your email. You still sign in with your email.
        </p>
        <input
          autoFocus
          value={value}
          maxLength={USERNAME_MAX}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Sara"
          aria-label="Username"
        />
        {error && <div style={{ color: 'var(--coral)', fontSize: 13, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 4, border: '1px solid var(--paper-line)', background: 'transparent', color: 'var(--ink)', fontWeight: 600 }}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={{ flex: 1, padding: 11, borderRadius: 4, border: 'none', background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
