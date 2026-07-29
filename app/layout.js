import './globals.css';

export const metadata = {
  title: 'The Running Account',
  description: 'Personal income, expense, and investment ledger.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
