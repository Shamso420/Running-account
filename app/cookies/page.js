import LegalLayout from '../../components/LegalLayout';

export const metadata = {
  title: 'Cookie Policy — The Running Account',
};

const h2 = { fontSize: 19, marginTop: 36, marginBottom: 12 };
const p = { margin: '0 0 14px' };
const ul = { margin: '0 0 14px', paddingLeft: 22 };
const li = { marginBottom: 6 };

export default function CookiesPage() {
  return (
    <LegalLayout eyebrow="Ledger No. 02" title="Cookie Policy" updated="October 20, 2026">
      <p style={p}>
        The Running Account does not use cookies for tracking, advertising, or analytics. We don't show a cookie
        consent banner because we don't set any cookies that would require one.
      </p>

      <h2 style={h2}>What we do use</h2>
      <p style={p}>
        The Service uses two kinds of browser storage — neither is a cookie, and both are strictly necessary for
        the app to function:
      </p>
      <ul style={ul}>
        <li style={li}><strong>Local storage</strong> — keeps you signed in between visits, managed by our authentication provider, Supabase.</li>
        <li style={li}><strong>Session storage</strong> — remembers which role (Admin / Entry / Viewer) you selected on a shared-login account, for the current browser tab only. It's cleared automatically when you close the tab.</li>
      </ul>
      <p style={p}>
        Neither is used to track you across sites, build an advertising profile, or share data with third parties.
      </p>

      <h2 style={h2}>Third-party requests</h2>
      <p style={p}>
        The page loads fonts from Google Fonts. Like any request to an external server, this can expose your
        IP address to Google as part of the standard request — Google Fonts does not set cookies as part of this.
      </p>

      <h2 style={h2}>If this changes</h2>
      <p style={p}>
        If we ever add analytics, advertising, or anything else that sets cookies, we'll update this policy and
        add a consent banner before any non-essential cookie is set.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions about this policy: <a href="mailto:alishamsedine8@gmail.com" style={{ color: 'var(--gold)' }}>alishamsedine8@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
