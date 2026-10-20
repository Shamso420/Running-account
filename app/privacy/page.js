import LegalLayout from '../../components/LegalLayout';

export const metadata = {
  title: 'Privacy Policy — The Running Account',
};

const h2 = { fontSize: 19, marginTop: 36, marginBottom: 12 };
const p = { margin: '0 0 14px' };
const ul = { margin: '0 0 14px', paddingLeft: 22 };
const li = { marginBottom: 6 };

export default function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Ledger No. 02" title="Privacy Policy" updated="October 20, 2026">
      <p style={p}>
        The Running Account ("the Service") is operated by Ali Shamsedine, an individual based in Lebanon
        ("we", "us"). This policy explains what information the Service collects, why, and how it's handled.
      </p>

      <h2 style={h2}>What we collect</h2>
      <ul style={ul}>
        <li style={li}><strong>Account information:</strong> the email address and password you sign up with. Your password is never seen or stored by our own code — it's handled entirely by our authentication provider, Supabase, which stores it hashed.</li>
        <li style={li}><strong>Ledger data you enter:</strong> income, expense, investment, sale, and debt entries — dates, amounts, categories, and any notes you write.</li>
        <li style={li}><strong>Customer records you create:</strong> name, phone number, and type, if you add customers for invoicing.</li>
        <li style={li}><strong>Account settings:</strong> your plan, role configuration, and similar preferences.</li>
      </ul>
      <p style={p}>
        We do not collect analytics, usage tracking, advertising identifiers, or any data beyond what's needed
        to run the ledger and invoicing features you use directly.
      </p>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>
        Your data is used solely to provide the Service to you: storing and displaying your ledger, generating
        invoices and reports, and enforcing access to your own account's data. We do not sell, rent, or share
        your data with advertisers or data brokers.
      </p>

      <h2 style={h2}>Who can see your data</h2>
      <p style={p}>
        Your entries are private to your account by default, enforced at the database level (Row Level Security),
        so other users of the Service cannot read your data. If you enable shared-login roles for your own account
        (e.g. to let staff add entries), people you share that access with can see what their role permits.
      </p>

      <h2 style={h2}>Where your data is stored</h2>
      <p style={p}>We rely on a small number of infrastructure providers to run the Service:</p>
      <ul style={ul}>
        <li style={li}><strong>Supabase</strong> — hosts our database and handles authentication.</li>
        <li style={li}><strong>Vercel</strong> — hosts and serves the web application.</li>
        <li style={li}><strong>Google Fonts</strong> — the page loads typefaces from Google's servers; as with any web font request, this can expose your IP address to Google as part of the standard request. No cookies are set by this.</li>
      </ul>
      <p style={p}>
        These providers act as data processors on our behalf — they store or transmit data to make the Service
        work, not for their own independent use.
      </p>

      <h2 style={h2}>Data retention</h2>
      <p style={p}>
        We keep your data for as long as your account is active. If you'd like your account and data deleted,
        contact us (below) and we'll remove it.
      </p>

      <h2 style={h2}>Your rights</h2>
      <p style={p}>
        You can request access to, correction of, or deletion of your data at any time by contacting us. We'll
        respond within a reasonable time.
      </p>

      <h2 style={h2}>Children's privacy</h2>
      <p style={p}>
        The Service is a general bookkeeping tool and isn't directed at children. We don't knowingly collect
        information from children.
      </p>

      <h2 style={h2}>Changes to this policy</h2>
      <p style={p}>
        If this policy changes — for example, if we add analytics or a new feature that collects additional data
        — we'll update this page and the date above.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions about this policy or your data: <a href="mailto:alishamsedine8@gmail.com" style={{ color: 'var(--gold)' }}>alishamsedine8@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
