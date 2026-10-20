import Link from 'next/link';

export default function LegalLayout({ eyebrow, title, updated, children }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, var(--green), var(--gold), var(--coral), var(--blue))' }} />
      <header style={{ borderBottom: '1px solid var(--paper-line)', padding: '26px 24px 18px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            The Running Account
          </Link>
          <Link href="/" style={{ color: 'var(--slate)', fontSize: 13 }}>&larr; Back home</Link>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>
          {eyebrow}
        </div>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>{title}</h1>
        <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 32 }}>Last updated {updated}</p>

        <div style={{ color: 'var(--ink)', fontSize: 15, lineHeight: 1.7 }}>
          {children}
        </div>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--paper-line)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href="/privacy" style={{ color: 'var(--slate)' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: 'var(--slate)' }}>Terms &amp; Conditions</Link>
          <Link href="/cookies" style={{ color: 'var(--slate)' }}>Cookie Policy</Link>
        </div>
      </main>
    </div>
  );
}
