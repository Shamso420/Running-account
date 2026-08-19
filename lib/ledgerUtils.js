export const RATE = 89000;

export const TYPES = [
  { key: 'income', label: 'Income', color: '#3F6E52' },
  { key: 'expense', label: 'Expense', color: '#B0463F' },
  { key: 'investment', label: 'Investment (bought)', color: '#B8894C' },
  { key: 'sale', label: 'Sale', color: '#4C7A9E' },
  { key: 'debt', label: 'Debt', color: '#8A6BA8' },
];

export const CATEGORY_SUGGESTIONS = {
  income: ['Salary', 'Freelance', 'Other income'],
  expense: ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Misc'],
  investment: ['Stocks', 'Goods', 'Products', 'Other'],
  sale: [
    'Whish / cash transfer',
    'Physical devices/accessories',
    'Telecom recharge/data',
    'Subscriptions / media',
    'Debt / late fees',
    'Gaming / gift cards',
    'USDT / crypto',
  ],
  debt: ['Loan to friend', 'Borrowed from friend', 'Advance', 'Other'],
};

export const CUSTOMER_TYPES = [
  { key: 'merchant', label: 'Merchant' },
  { key: 'retail', label: 'Retail' },
  { key: 'customer', label: 'Customer' },
];

export const PAYMENT_METHODS = ['Cash', 'Whish', 'Bank Transfer', 'Card', 'Crypto', 'Other'];

export const FREQUENCIES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export function saleCollectionStatus(entry) {
  const price = Number(entry.usd) || 0;
  const received = Number(entry.received_usd) || 0;
  if (price <= 0) return 'Paid';
  if (received >= price) return 'Paid';
  if (received > 0) return 'Partial';
  return 'Unpaid';
}

export function debtCollectionStatus(entry) {
  const total = Number(entry.usd) || 0;
  const received = Number(entry.received_usd) || 0;
  if (entry.status === 'settled' || (total > 0 && received >= total)) return 'Settled';
  if (received > 0) return 'Partial';
  return 'Unpaid';
}

export const BUSINESS_CATEGORIES = [
  { key: 'subscriptions_media', label: 'Subscriptions / Media' },
  { key: 'wish_transfers', label: 'Wish Transfers' },
  { key: 'gaming', label: 'Gaming' },
  { key: 'usdt', label: 'USDT' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'devices', label: 'Devices' },
  { key: 'other', label: 'Other' },
];

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
