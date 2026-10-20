import LegalLayout from '../../components/LegalLayout';

export const metadata = {
  title: 'Terms & Conditions — The Running Account',
};

const h2 = { fontSize: 19, marginTop: 36, marginBottom: 12 };
const p = { margin: '0 0 14px' };
const ul = { margin: '0 0 14px', paddingLeft: 22 };
const li = { marginBottom: 6 };

export default function TermsPage() {
  return (
    <LegalLayout eyebrow="Ledger No. 02" title="Terms & Conditions" updated="October 20, 2026">
      <p style={p}>
        These terms govern your use of The Running Account ("the Service"), operated by Ali Shamsedine, an
        individual based in Lebanon ("we", "us"). By creating an account or using the Service, you agree to them.
      </p>

      <h2 style={h2}>The Service</h2>
      <p style={p}>
        The Running Account is a bookkeeping and invoicing tool for tracking income, expenses, investments,
        sales, and debts. It's provided free of charge. We may add, change, or remove features at any time.
      </p>

      <h2 style={h2}>Your account</h2>
      <ul style={ul}>
        <li style={li}>You're responsible for the accuracy of the information you provide and for keeping your login credentials secure.</li>
        <li style={li}>You're responsible for the accuracy of the ledger entries, customer records, and other data you enter — the Service does not verify or audit your figures.</li>
        <li style={li}>You must be legally able to enter into this agreement under the laws that apply to you.</li>
      </ul>

      <h2 style={h2}>Acceptable use</h2>
      <p style={p}>
        You agree not to use the Service for anything unlawful, to attempt to access another account or data you're
        not authorized to see, or to disrupt or interfere with the Service's normal operation.
      </p>

      <h2 style={h2}>Your data</h2>
      <p style={p}>
        You own the data you enter into the Service. We don't claim any ownership over your ledger entries,
        customer records, or other content you create. See our <a href="/privacy" style={{ color: 'var(--gold)' }}>Privacy Policy</a> for how that data is handled.
      </p>

      <h2 style={h2}>No warranty</h2>
      <p style={p}>
        The Service is provided "as is," without warranty of any kind. We don't guarantee it will be uninterrupted,
        error-free, or fit for any particular purpose. You're responsible for independently verifying any figures
        or reports the Service generates before relying on them for financial or business decisions.
      </p>

      <h2 style={h2}>Limitation of liability</h2>
      <p style={p}>
        To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential
        damages arising from your use of the Service, including loss of data, revenue, or profits.
      </p>

      <h2 style={h2}>Termination</h2>
      <p style={p}>
        You may stop using the Service and request deletion of your account at any time. We may suspend or
        terminate accounts that violate these terms.
      </p>

      <h2 style={h2}>Changes to these terms</h2>
      <p style={p}>
        We may update these terms from time to time. If we make material changes, we'll update the date above.
        Continuing to use the Service after a change means you accept the updated terms.
      </p>

      <h2 style={h2}>Governing law</h2>
      <p style={p}>These terms are governed by the laws of Lebanon.</p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions about these terms: <a href="mailto:alishamsedine8@gmail.com" style={{ color: 'var(--gold)' }}>alishamsedine8@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
