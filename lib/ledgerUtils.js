export const RATE = 89000;

export const TYPES = [
  { key: 'income', label: 'Income', color: '#3F6E52' },
  { key: 'expense', label: 'Expense', color: '#B0463F' },
  { key: 'investment', label: 'Investment (bought)', color: '#B8894C' },
  { key: 'profit', label: 'Sale profit', color: '#4C7A9E' },
  { key: 'debt', label: 'Debt', color: '#8A6BA8' },
];

export const CATEGORY_SUGGESTIONS = {
  income: ['Salary', 'Freelance', 'Other income'],
  expense: ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Misc'],
  investment: ['Stocks', 'Goods', 'Products', 'Other'],
  profit: ['Goods resale', 'Products resale', 'Stocks sale', 'Other'],
  debt: ['Loan to friend', 'Borrowed from friend', 'Advance', 'Other'],
};

export function fmtUSD(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '$0.00';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function fmtLBP(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '0 LBP';
  return Math.round(v).toLocaleString('en-US') + ' LBP';
}

export function toUsdLbp(amount, currency) {
  const amt = Number(amount);
  if (currency === 'LBP') {
    return { usd: amt / RATE, lbp: amt };
  }
  return { usd: amt, lbp: amt * RATE };
}
