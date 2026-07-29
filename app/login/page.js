'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setInfo('Account created. Check your email to confirm it, then log in below.');
        setMode('login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>
          Ledger No. 02
        </div>
        <h1 style={{ fontSize: 28, textAlign: 'center', marginBottom: 28 }}>The Running Account</h1>

        <div style={{ display: 'flex', border: '1px solid var(--paper-line)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          <button
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            style={{ flex: 1, padding: 10, border: 'none', background: mode === 'login' ? 'var(--ink)' : 'transparent', color: mode === 'login' ? 'var(--paper)' : 'var(--slate)', fontWeight: 600 }}
          >
            Log in
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
            style={{ flex: 1, padding: 10, border: 'none', background: mode === 'signup' ? 'var(--ink)' : 'transparent', color: mode === 'signup' ? 'var(--paper)' : 'var(--slate)', fontWeight: 600 }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            Password
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 6 }} />
          </label>

          {error && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{error}</div>}
          {info && <div style={{ color: 'var(--green)', fontSize: 13 }}>{info}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{ marginTop: 6, padding: 12, border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--slate)', textAlign: 'center', marginTop: 20 }}>
          Your password is verified by Supabase and never stored or visible in this app's code.
        </p>
      </div>
    </div>
  );
}
