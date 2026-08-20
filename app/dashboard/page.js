'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { RATE, TYPES, CATEGORY_SUGGESTIONS, CUSTOMER_TYPES, PAYMENT_METHODS, FREQUENCIES, saleCollectionStatus, debtCollectionStatus, fmtUSD, fmtLBP, toUsdLbp } from '../../lib/ledgerUtils';

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  category: '',
  where: '',
  customerId: null,
  amount: '',
  currency: 'LBP',
  notes: '',
  debtDirection: 'owed_to_me',
  private: false,
  product: '',
  cost: '',
  receivedNow: '',
  supplier: '',
  paymentMethod: 'Cash',
});

function saleProfitUsd(e) {
  return Number(e.usd) - Number(e.cost_usd || 0);
}

function invoiceProfitBreakdown(e) {
  const isDirectSale = e.type === 'sale' && !!e.product;
  const isSoldInvestment = e.type === 'investment' && e.status === 'sold';
  if (!isDirectSale && !isSoldInvestment) return null;
  const boughtFor = isDirectSale ? Number(e.cost_usd || 0) : Number(e.usd);
  const soldFor = isDirectSale ? Number(e.usd) : Number(e.sold_usd);
  return { boughtFor, soldFor, profit: soldFor - boughtFor };
}

function computeSaleStats(saleEntries, payments) {
  const transactions = saleEntries.length;
  const revenue = saleEntries.reduce((s, e) => s + Number(e.usd), 0);
  const cost = saleEntries.reduce((s, e) => s + Number(e.cost_usd || 0), 0);
  const grossProfit = revenue - cost;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
  const avgProfitPerSale = transactions > 0 ? grossProfit / transactions : 0;
  const collected = payments.reduce((s, p) => s + Number(p.usd), 0);
  const openReceivables = revenue - collected;
  const collectionRate = revenue > 0 ? collected / revenue : 0;

  const byCategory = {};
  saleEntries.forEach((e) => {
    if (!byCategory[e.category]) byCategory[e.category] = { category: e.category, transactions: 0, revenue: 0, cost: 0, profit: 0, openBalance: 0 };
    const c = byCategory[e.category];
    c.transactions += 1;
    c.revenue += Number(e.usd);
    c.cost += Number(e.cost_usd || 0);
    c.profit += saleProfitUsd(e);
    c.openBalance += Number(e.usd) - Number(e.received_usd || 0);
  });
  const categories = Object.values(byCategory)
    .map((c) => ({ ...c, margin: c.revenue > 0 ? c.profit / c.revenue : 0 }))
    .sort((a, b) => b.profit - a.profit);
  const bestCategory = categories.length ? categories[0] : null;
  const worstCategory = categories.length ? categories[categories.length - 1] : null;

  return { transactions, revenue, cost, grossProfit, grossMargin, avgProfitPerSale, collected, openReceivables, collectionRate, categories, bestCategory, worstCategory };
}

const PIE_COLORS = ['#B8894C', '#B0463F', '#3F6E52', '#4C7A9E', '#8A6BA8', '#C48A3F', '#6B8F8A', '#9E6B5C'];

const GOAL_PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const GOAL_METRICS = [
  { key: 'income_plus_profit', label: 'Income + sale profit' },
  { key: 'income', label: 'Income only' },
  { key: 'profit', label: 'Sale profit only' },
  { key: 'net', label: 'Net (income + profit − expenses − investments)' },
];

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function periodRange(period) {
  const now = new Date();
  if (period === 'daily') {
    const s = localDateStr(now);
    return { start: s, end: s };
  }
  if (period === 'weekly') {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: localDateStr(monday), end: localDateStr(sunday) };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: localDateStr(first), end: localDateStr(last) };
}

function computeAchieved(goal, entries) {
  const { start, end } = periodRange(goal.period);
  const relevant = entries.filter((e) => e.entry_date >= start && e.entry_date <= end);
  if (goal.metric === 'income') return relevant.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.usd), 0);
  if (goal.metric === 'profit') return relevant.filter((e) => e.type === 'sale').reduce((s, e) => s + saleProfitUsd(e), 0);
  if (goal.metric === 'income_plus_profit') {
    return relevant.reduce((s, e) => {
      if (e.type === 'income') return s + Number(e.usd);
      if (e.type === 'sale') return s + saleProfitUsd(e);
      return s;
    }, 0);
  }
  return relevant.reduce((s, e) => {
    if (e.type === 'income') return s + Number(e.usd);
    if (e.type === 'sale') return s + saleProfitUsd(e);
    if (e.type === 'expense' || e.type === 'investment') return s - Number(e.usd);
    return s;
  }, 0);
}

function invoiceNumber(entry) {
  return `INV-${entry.entry_date.replace(/-/g, '')}-${entry.id.slice(0, 6).toUpperCase()}`;
}

function invoiceDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${Number(d)}-${Number(m)}-${y.slice(2)}`;
}

const BOUGHT_FROM_TYPES = ['expense', 'investment'];

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = loading, null = no session
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState('free');
  const [useRoles, setUseRoles] = useState(false);
  const [role, setRole] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [checkingPin, setCheckingPin] = useState(false);

  const canEdit = !useRoles || role === 'admin';
  const canAdd = !useRoles || role === 'admin' || role === 'entry';
  const canSettleDebt = !useRoles || role === 'admin' || role === 'entry';
  const canDeleteEntry = !useRoles || role === 'admin' || role === 'entry';
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState({ label: '', period: 'weekly', metric: 'income_plus_profit', amount: '', currency: 'USD' });
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [allEntries, setAllEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('customer');
  const [customerError, setCustomerError] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerType, setEditCustomerType] = useState('customer');
  const [editCustomerError, setEditCustomerError] = useState('');
  const [savingCustomerEdit, setSavingCustomerEdit] = useState(false);
  const [payingEntry, setPayingEntry] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', currency: 'USD', method: 'Cash' });
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const [increasingDebt, setIncreasingDebt] = useState(null);
  const [increaseForm, setIncreaseForm] = useState({ amount: '', currency: 'USD' });
  const [increaseError, setIncreaseError] = useState('');
  const [increasing, setIncreasing] = useState(false);
  const [costForm, setCostForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', currency: 'LBP', frequency: 'monthly' });
  const [wageForm, setWageForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', currency: 'LBP', frequency: 'monthly' });
  const [costError, setCostError] = useState('');
  const [savingCost, setSavingCost] = useState(false);
  const [debtForm, setDebtForm] = useState({ date: new Date().toISOString().slice(0, 10), who: '', direction: 'owed_to_me', category: '', amount: '', currency: 'LBP', notes: '' });
  const [debtFormError, setDebtFormError] = useState('');
  const [savingDebt, setSavingDebt] = useState(false);
  const [debtStartDate, setDebtStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [debtEndDate, setDebtEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [salePayments, setSalePayments] = useState([]);
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().toISOString().slice(0, 7));
  const entries = useMemo(
    () => (useRoles && role !== 'admin' ? allEntries.filter((e) => !e.private) : allEntries),
    [allEntries, useRoles, role]
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntryStatus, setEditingEntryStatus] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [sellingEntry, setSellingEntry] = useState(null);
  const [invoiceEntry, setInvoiceEntry] = useState(null);
  const [sellForm, setSellForm] = useState({ amount: '', currency: 'USD', date: new Date().toISOString().slice(0, 10), soldTo: '' });
  const [sellError, setSellError] = useState('');
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
      } else {
        setSession(data.session);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!sess) router.replace('/login');
      else setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, plan, use_roles')
        .eq('id', session.user.id)
        .single();
      setIsAdmin(!!profile?.is_admin);
      setPlan(profile?.plan || 'free');
      setUseRoles(!!profile?.use_roles);

      if (profile?.use_roles) {
        const savedRole = typeof window !== 'undefined' ? sessionStorage.getItem('rat_role') : null;
        if (savedRole === 'admin' || savedRole === 'entry' || savedRole === 'viewer') {
          setRole(savedRole);
        }
      }

      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (error) setLoadError(error.message);
      else setAllEntries(data || []);

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .order('code', { ascending: true });
      setCustomers(customersData || []);

      const { data: paymentsData } = await supabase
        .from('sale_payments')
        .select('*')
        .order('payment_date', { ascending: false });
      setSalePayments(paymentsData || []);

      if (profile?.plan === 'business') {
        const { data: goalsData } = await supabase
          .from('goals')
          .select('*')
          .order('created_at', { ascending: false });
        setGoals(goalsData || []);
      }
      setLoading(false);
    })();
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') sessionStorage.removeItem('rat_role');
    router.replace('/login');
  };

  const checkPin = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setCheckingPin(true);
    setPinError('');
    const { data, error } = await supabase.rpc('check_role_pin', { p_pin: pinInput.trim() });
    setCheckingPin(false);
    if (error || !data) {
      setPinError('Incorrect PIN.');
      setPinInput('');
      return;
    }
    setRole(data);
    if (typeof window !== 'undefined') sessionStorage.setItem('rat_role', data);
    setPinInput('');
  };

  const switchRole = () => {
    setRole(null);
    setPinInput('');
    setPinError('');
    if (typeof window !== 'undefined') sessionStorage.removeItem('rat_role');
  };

  const selectCustomer = (customer) => {
    setForm((f) => ({ ...f, where: `${customer.name} (${customer.code})`, customerId: customer.id }));
    setCustomerModalOpen(false);
    setCustomerSearch('');
  };

  const clearCustomer = () => {
    setForm((f) => ({ ...f, where: '', customerId: null }));
  };

  const createCustomer = async () => {
    if (!newCustomerName.trim()) { setCustomerError('Enter a name.'); return; }
    setCreatingCustomer(true);
    setCustomerError('');
    const maxCode = customers.reduce((max, c) => Math.max(max, parseInt(c.code, 10) || 0), 0);
    const nextCode = String(maxCode + 1).padStart(5, '0');
    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: session.user.id,
        code: nextCode,
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        type: newCustomerType,
      })
      .select()
      .single();
    setCreatingCustomer(false);
    if (error) { setCustomerError('Could not save: ' + error.message); return; }
    setCustomers((prev) => [...prev, data].sort((a, b) => a.code.localeCompare(b.code)));
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerType('customer');
    selectCustomer(data);
  };

  const openEditCustomer = (c) => {
    setEditingCustomer(c);
    setEditCustomerName(c.name);
    setEditCustomerPhone(c.phone || '');
    setEditCustomerType(c.type || 'customer');
    setEditCustomerError('');
  };

  const cancelEditCustomer = () => {
    setEditingCustomer(null);
    setEditCustomerError('');
  };

  const saveEditCustomer = async () => {
    if (!editCustomerName.trim()) { setEditCustomerError('Enter a name.'); return; }
    setSavingCustomerEdit(true);
    setEditCustomerError('');
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: editCustomerName.trim(),
        phone: editCustomerPhone.trim() || null,
        type: editCustomerType,
      })
      .eq('id', editingCustomer.id)
      .select()
      .single();
    setSavingCustomerEdit(false);
    if (error) { setEditCustomerError('Could not save: ' + error.message); return; }
    setCustomers((prev) => prev.map((c) => (c.id === data.id ? data : c)).sort((a, b) => a.code.localeCompare(b.code)));
    if (form.customerId === data.id) {
      setForm((f) => ({ ...f, where: `${data.name} (${data.code})` }));
    }
    setEditingCustomer(null);
  };

  const startEditEntry = (entry) => {
    setForm({
      date: entry.entry_date,
      type: entry.type,
      category: entry.category || '',
      where: entry.where_text || '',
      customerId: entry.customer_id || null,
      amount: String(entry.amount_raw),
      currency: entry.currency || 'USD',
      notes: entry.notes || '',
      debtDirection: entry.debt_direction || 'owed_to_me',
      private: !!entry.private,
      product: entry.product || '',
      cost: entry.cost_raw != null ? String(entry.cost_raw) : '',
      receivedNow: '',
      supplier: entry.supplier_text || '',
      paymentMethod: entry.payment_method || 'Cash',
    });
    setEditingEntryId(entry.id);
    setEditingEntryStatus(entry.status || null);
    setFormError('');
    setTab('add');
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditingEntryStatus(null);
    setForm(emptyForm());
    setFormError('');
  };

  const addEntry = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setFormError('Enter an amount greater than zero.'); return; }
    if (!form.category.trim()) { setFormError('Enter a category.'); return; }
    if (form.type === 'sale' && !form.product.trim()) { setFormError('Enter the product or service sold.'); return; }
    const costAmt = form.type === 'sale' ? parseFloat(form.cost) : null;
    if (form.type === 'sale' && (Number.isNaN(costAmt) || costAmt < 0)) { setFormError('Enter a cost (0 or more).'); return; }
    setFormError('');
    setSaving(true);
    const { usd, lbp } = toUsdLbp(amt, form.currency);

    if (editingEntryId) {
      let costFields = {};
      if (form.type === 'sale') {
        const { usd: costUsd, lbp: costLbp } = toUsdLbp(costAmt, form.currency);
        costFields = {
          product: form.product.trim(), cost_raw: costAmt, cost_usd: costUsd, cost_lbp: costLbp,
          supplier_text: form.supplier.trim(), payment_method: form.paymentMethod,
        };
      } else if (form.type === 'investment') {
        costFields = { supplier_text: form.supplier.trim() };
      }
      // Investment "sold to" can only be edited once the item is actually sold — otherwise leave where_text untouched.
      const investmentEditingSold = form.type === 'investment' && editingEntryStatus === 'sold';
      const { data, error } = await supabase
        .from('entries')
        .update({
          entry_date: form.date,
          category: form.category.trim(),
          where_text: form.type === 'investment' ? (investmentEditingSold ? form.where.trim() : undefined) : form.where.trim(),
          notes: form.notes.trim(),
          currency: form.currency,
          amount_raw: amt,
          usd, lbp,
          debt_direction: form.type === 'debt' ? form.debtDirection : null,
          customer_id: form.type === 'investment' ? undefined : (form.customerId || null),
          private: useRoles && role === 'admin' ? !!form.private : undefined,
          ...costFields,
        })
        .eq('id', editingEntryId)
        .select()
        .single();
      setSaving(false);
      if (error) { setFormError('Could not save: ' + error.message); return; }
      setAllEntries((prev) => prev.map((en) => (en.id === data.id ? data : en)).sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
      setEditingEntryId(null);
      setEditingEntryStatus(null);
      setForm(emptyForm());
      setTab('ledger');
      return;
    }

    let costFields = {};
    let initialPaymentRaw = 0;
    let initialPaymentUsdLbp = { usd: 0, lbp: 0 };
    if (form.type === 'sale') {
      const { usd: costUsd, lbp: costLbp } = toUsdLbp(costAmt, form.currency);
      const receivedRaw = form.receivedNow.trim() === '' ? amt : parseFloat(form.receivedNow);
      initialPaymentRaw = Number.isNaN(receivedRaw) ? 0 : Math.min(Math.max(receivedRaw, 0), amt);
      initialPaymentUsdLbp = toUsdLbp(initialPaymentRaw, form.currency);
      costFields = {
        product: form.product.trim(), cost_raw: costAmt, cost_usd: costUsd, cost_lbp: costLbp,
        received_usd: initialPaymentUsdLbp.usd, supplier_text: form.supplier.trim(), payment_method: form.paymentMethod,
      };
    } else if (form.type === 'investment') {
      costFields = { supplier_text: form.supplier.trim() };
    }
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: session.user.id,
        entry_date: form.date,
        type: form.type,
        category: form.category.trim(),
        // Investment entries start with no "sold to" — that's only set once the item is sold.
        where_text: form.type === 'investment' ? '' : form.where.trim(),
        notes: form.notes.trim(),
        currency: form.currency,
        amount_raw: amt,
        usd, lbp,
        debt_direction: form.type === 'debt' ? form.debtDirection : null,
        customer_id: form.type === 'investment' ? null : (form.customerId || null),
        private: useRoles && role === 'admin' ? !!form.private : false,
        ...costFields,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { setFormError('Could not save: ' + error.message); return; }
    setAllEntries((prev) => [data, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
    if (form.type === 'sale' && initialPaymentRaw > 0) {
      const { data: paymentRow } = await supabase
        .from('sale_payments')
        .insert({
          user_id: session.user.id,
          entry_id: data.id,
          payment_date: form.date,
          amount_raw: initialPaymentRaw,
          currency: form.currency,
          usd: initialPaymentUsdLbp.usd,
          lbp: initialPaymentUsdLbp.lbp,
          payment_method: form.paymentMethod,
        })
        .select()
        .single();
      if (paymentRow) setSalePayments((prev) => [paymentRow, ...prev]);
    }
    setForm((f) => ({ ...emptyForm(), type: f.type, currency: f.currency }));
  };

  const openSell = (entry) => {
    setSellingEntry(entry);
    setSellForm({ amount: '', currency: entry.currency || 'USD', date: new Date().toISOString().slice(0, 10), soldTo: '' });
    setSellError('');
  };

  const confirmSell = async () => {
    const saleAmt = parseFloat(sellForm.amount);
    if (!saleAmt || saleAmt <= 0) { setSellError('Enter a sale amount greater than zero.'); return; }
    setSelling(true);
    setSellError('');
    const { usd: soldUsd, lbp: soldLbp } = toUsdLbp(saleAmt, sellForm.currency);
    const profitUsd = soldUsd - Number(sellingEntry.usd);
    const profitLbp = profitUsd * RATE;
    const soldToText = sellForm.soldTo.trim();

    const { data: profitEntry, error: profitError } = await supabase
      .from('entries')
      .insert({
        user_id: session.user.id,
        entry_date: sellForm.date,
        type: 'sale',
        category: sellingEntry.category,
        where_text: soldToText,
        notes: `${profitUsd >= 0 ? 'Profit' : 'Loss'} from sale of ${sellingEntry.category}`,
        currency: 'USD',
        amount_raw: Math.max(Math.abs(profitUsd), 0.01),
        usd: profitUsd,
        lbp: profitLbp,
        received_usd: profitUsd,
      })
      .select()
      .single();

    if (profitError) { setSelling(false); setSellError('Could not save: ' + profitError.message); return; }

    const { data: updatedAsset, error: updateError } = await supabase
      .from('entries')
      .update({
        status: 'sold',
        sold_amount_raw: saleAmt,
        sold_currency: sellForm.currency,
        sold_usd: soldUsd,
        sold_lbp: soldLbp,
        sold_date: sellForm.date,
        where_text: soldToText,
        linked_profit_entry_id: profitEntry.id,
      })
      .eq('id', sellingEntry.id)
      .select()
      .single();

    setSelling(false);
    if (updateError) { setSellError('Sale logged, but could not update the item: ' + updateError.message); return; }

    setAllEntries((prev) => [
      profitEntry,
      ...prev.map((e) => (e.id === updatedAsset.id ? updatedAsset : e)),
    ].sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
    const { data: paymentRow } = await supabase
      .from('sale_payments')
      .insert({
        user_id: session.user.id,
        entry_id: profitEntry.id,
        payment_date: sellForm.date,
        amount_raw: Math.max(Math.abs(profitUsd), 0.01),
        currency: 'USD',
        usd: profitUsd,
        lbp: profitLbp,
      })
      .select()
      .single();
    if (paymentRow) setSalePayments((prev) => [paymentRow, ...prev]);
    setSellingEntry(null);
  };

  const settleDebt = async (entry) => {
    const { data, error } = await supabase
      .from('entries')
      .update({ status: 'settled', received_usd: entry.usd })
      .eq('id', entry.id)
      .select()
      .single();
    if (!error) setAllEntries((prev) => prev.map((e) => (e.id === entry.id ? data : e)));
  };

  const openRecordPayment = (entry) => {
    setPayingEntry(entry);
    setPayForm({ amount: '', currency: entry.currency || 'USD', method: 'Cash', date: new Date().toISOString().slice(0, 10) });
    setPayError('');
  };

  const confirmRecordPayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { setPayError('Enter an amount greater than zero.'); return; }
    setPaying(true);
    setPayError('');
    const { usd: paidUsd, lbp: paidLbp } = toUsdLbp(amt, payForm.currency);
    const newReceivedUsd = Math.min(Number(payingEntry.received_usd || 0) + paidUsd, Number(payingEntry.usd));
    const updateFields = { received_usd: newReceivedUsd };
    if (payingEntry.type === 'debt' && newReceivedUsd >= Number(payingEntry.usd) - 0.001) {
      updateFields.status = 'settled';
    }
    const { data, error } = await supabase
      .from('entries')
      .update(updateFields)
      .eq('id', payingEntry.id)
      .select()
      .single();
    if (error) { setPaying(false); setPayError('Could not save: ' + error.message); return; }
    const { data: paymentRow, error: paymentError } = await supabase
      .from('sale_payments')
      .insert({
        user_id: session.user.id,
        entry_id: payingEntry.id,
        payment_date: payForm.date,
        amount_raw: amt,
        currency: payForm.currency,
        usd: paidUsd,
        lbp: paidLbp,
        payment_method: payForm.method,
      })
      .select()
      .single();
    setPaying(false);
    if (paymentError) { setPayError('Payment recorded on the sale, but history could not be saved: ' + paymentError.message); }
    setAllEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    if (paymentRow) setSalePayments((prev) => [paymentRow, ...prev]);
    setPayingEntry(null);
  };

  const openIncreaseDebt = (entry) => {
    setIncreasingDebt(entry);
    setIncreaseForm({ amount: '', currency: entry.currency || 'USD' });
    setIncreaseError('');
  };

  const confirmIncreaseDebt = async () => {
    const amt = parseFloat(increaseForm.amount);
    if (!amt || amt <= 0) { setIncreaseError('Enter an amount greater than zero.'); return; }
    setIncreasing(true);
    setIncreaseError('');
    const { usd: addedUsd } = toUsdLbp(amt, increaseForm.currency);
    const newUsd = Number(increasingDebt.usd) + addedUsd;
    const newLbp = newUsd * RATE;
    const updateFields = {
      usd: newUsd,
      lbp: newLbp,
      amount_raw: increasingDebt.currency === 'LBP' ? newLbp : newUsd,
    };
    if (increasingDebt.status === 'settled') {
      updateFields.status = 'active';
    }
    const { data, error } = await supabase
      .from('entries')
      .update(updateFields)
      .eq('id', increasingDebt.id)
      .select()
      .single();
    setIncreasing(false);
    if (error) { setIncreaseError('Could not save: ' + error.message); return; }
    setAllEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    setIncreasingDebt(null);
  };

  const addRecurringCost = async (section, form, setForm) => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setCostError('Enter an amount greater than zero.'); return; }
    if (!form.description.trim()) { setCostError(section === 'wage' ? 'Enter who this wage is for.' : 'Enter a description.'); return; }
    setCostError('');
    setSavingCost(true);
    const { usd, lbp } = toUsdLbp(amt, form.currency);
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: session.user.id,
        entry_date: form.date,
        type: 'expense',
        category: form.description.trim(),
        where_text: '',
        notes: '',
        currency: form.currency,
        amount_raw: amt,
        usd, lbp,
        cost_section: section,
        recurrence: form.frequency,
      })
      .select()
      .single();
    setSavingCost(false);
    if (error) { setCostError('Could not save: ' + error.message); return; }
    setAllEntries((prev) => [data, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
    setForm((f) => ({ ...f, description: '', amount: '' }));
  };

  const editRecurringCost = async (id, form) => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return { error: 'Enter an amount greater than zero.' };
    if (!form.description.trim()) return { error: 'Enter a description.' };
    const { usd, lbp } = toUsdLbp(amt, form.currency);
    const { data, error } = await supabase
      .from('entries')
      .update({
        entry_date: form.date,
        category: form.description.trim(),
        currency: form.currency,
        amount_raw: amt,
        usd, lbp,
        recurrence: form.frequency,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: 'Could not save: ' + error.message };
    setAllEntries((prev) => prev.map((e) => (e.id === id ? data : e)).sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
    return {};
  };

  const addDebtEntry = async () => {
    const amt = parseFloat(debtForm.amount);
    if (!amt || amt <= 0) { setDebtFormError('Enter an amount greater than zero.'); return; }
    if (!debtForm.who.trim()) { setDebtFormError('Enter who this debt is with.'); return; }
    setDebtFormError('');
    setSavingDebt(true);
    const { usd, lbp } = toUsdLbp(amt, debtForm.currency);
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: session.user.id,
        entry_date: debtForm.date,
        type: 'debt',
        category: debtForm.category.trim() || 'Other',
        where_text: debtForm.who.trim(),
        notes: debtForm.notes.trim(),
        currency: debtForm.currency,
        amount_raw: amt,
        usd, lbp,
        debt_direction: debtForm.direction,
      })
      .select()
      .single();
    setSavingDebt(false);
    if (error) { setDebtFormError('Could not save: ' + error.message); return; }
    setAllEntries((prev) => [data, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)));
    setDebtForm((f) => ({ ...f, who: '', category: '', amount: '', notes: '' }));
  };

  const addGoal = async (e) => {
    e.preventDefault();
    const amt = parseFloat(goalForm.amount);
    if (!amt || amt <= 0) { setGoalError('Enter a target greater than zero.'); return; }
    if (!goalForm.label.trim()) { setGoalError('Give this goal a short label.'); return; }
    setGoalError('');
    setGoalSaving(true);
    const { usd } = toUsdLbp(amt, goalForm.currency);
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: session.user.id,
        label: goalForm.label.trim(),
        period: goalForm.period,
        metric: goalForm.metric,
        target_usd: usd,
      })
      .select()
      .single();
    setGoalSaving(false);
    if (error) { setGoalError('Could not save: ' + error.message); return; }
    setGoals((prev) => [data, ...prev]);
    setGoalForm({ label: '', period: 'weekly', metric: 'income_plus_profit', amount: '', currency: 'USD' });
  };

  const deleteGoal = async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (!error) setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const deleteEntry = async (id) => {
    const { error } = await supabase.from('entries').delete().eq('id', id);
    if (!error) setAllEntries((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  };

  const exportCSV = () => {
    const headers = ['date', 'type', 'category', 'product', 'where', 'amount', 'currency', 'lbp', 'usd', 'cost_usd', 'received_usd', 'notes'];
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = entries.map((e) => [
      e.entry_date, e.type, e.category, e.product || '', e.where_text, e.amount_raw, e.currency,
      Math.round(e.lbp), Number(e.usd).toFixed(2),
      e.type === 'sale' ? Number(e.cost_usd || 0).toFixed(2) : '',
      e.type === 'sale' ? Number(e.received_usd || 0).toFixed(2) : '',
      e.notes,
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, investment: 0, sale: 0 };
    let debtOwedToMe = 0;
    let debtIOwe = 0;
    entries.forEach((e) => {
      if (e.type === 'debt') {
        if (e.status === 'settled') return;
        const balance = Number(e.usd) - Number(e.received_usd || 0);
        if (e.debt_direction === 'i_owe') debtIOwe += balance;
        else debtOwedToMe += balance;
      } else if (e.type === 'investment' && e.status === 'sold') {
        // Cost already recovered (plus/minus profit) via the linked Sale entry — don't double count.
      } else if (e.type === 'sale') {
        t.sale += saleProfitUsd(e);
      } else {
        t[e.type] += Number(e.usd);
      }
    });
    const netDebt = debtOwedToMe - debtIOwe;
    return {
      ...t,
      debtOwedToMe,
      debtIOwe,
      netDebt,
      net: t.income + t.sale - t.expense - t.investment + netDebt,
    };
  }, [entries]);

  const expenseByCategory = useMemo(() => {
    const m = {};
    entries.filter((e) => e.type === 'expense' && !e.cost_section).forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.usd); });
    const costsTotal = entries.filter((e) => e.type === 'expense' && e.cost_section === 'cost').reduce((s, e) => s + Number(e.usd), 0);
    const wagesTotal = entries.filter((e) => e.type === 'expense' && e.cost_section === 'wage').reduce((s, e) => s + Number(e.usd), 0);
    if (costsTotal > 0) m['360 Cell costs'] = costsTotal;
    if (wagesTotal > 0) m['Wages'] = wagesTotal;
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [entries]);

  const investmentByCategory = useMemo(() => {
    const m = {};
    entries.filter((e) => e.type === 'investment' && e.status !== 'sold').forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.usd); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [entries]);

  const monthly = useMemo(() => {
    const m = {};
    entries.forEach((e) => {
      if (e.type === 'debt') return;
      if (e.type === 'investment' && e.status === 'sold') return;
      const key = e.entry_date.slice(0, 7);
      if (!m[key]) m[key] = { month: key, income: 0, expense: 0, investment: 0, sale: 0 };
      if (e.type === 'sale') m[key].sale += saleProfitUsd(e);
      else m[key][e.type] += Number(e.usd);
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const trend = useMemo(() => {
    let running = 0;
    return monthly.map((m) => {
      const net = m.income + m.sale - m.expense - m.investment;
      running += net;
      return { month: m.month, income: m.income, expense: m.expense, net: running };
    });
  }, [monthly]);

  const visibleEntries = useMemo(() => {
    let result = filterType === 'all' ? entries : entries.filter((e) => e.type === filterType);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => {
        const haystack = [e.category, e.where_text, e.notes, e.entry_date].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    return result;
  }, [entries, filterType, searchQuery]);

  const monthGroups = useMemo(() => {
    const m = {};
    visibleEntries.forEach((e) => {
      const key = e.entry_date.slice(0, 7);
      if (!m[key]) m[key] = { month: key, entries: [], income: 0, expense: 0, investment: 0, sale: 0, debtOwedToMe: 0, debtIOwe: 0 };
      m[key].entries.push(e);
      if (e.type === 'debt') {
        if (e.status !== 'settled') {
          const balance = Number(e.usd) - Number(e.received_usd || 0);
          if (e.debt_direction === 'i_owe') m[key].debtIOwe += balance;
          else m[key].debtOwedToMe += balance;
        }
      } else if (e.type === 'investment' && e.status === 'sold') {
        // Excluded from month totals for the same reason as the overall totals above.
      } else if (e.type === 'sale') {
        m[key].sale += saleProfitUsd(e);
      } else {
        m[key][e.type] += Number(e.usd);
      }
    });
    return Object.values(m)
      .map((g) => ({ ...g, net: g.income + g.sale - g.expense - g.investment + g.debtOwedToMe - g.debtIOwe }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [visibleEntries]);

  const monthLabel = (key) => {
    const [y, mo] = key.split('-');
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const reportStats = useMemo(() => {
    const start = reportStartDate;
    const end = reportEndDate < reportStartDate ? reportStartDate : reportEndDate;
    const periodSales = entries.filter((e) => e.type === 'sale' && e.entry_date >= start && e.entry_date <= end && e.product);
    const periodPayments = salePayments.filter((p) => p.payment_date >= start && p.payment_date <= end);
    return computeSaleStats(periodSales, periodPayments);
  }, [entries, salePayments, reportStartDate, reportEndDate]);

  const monthlyStats = useMemo(() => {
    const monthSales = entries.filter((e) => e.type === 'sale' && e.entry_date.slice(0, 7) === monthlyMonth && e.product);
    const monthPayments = salePayments.filter((p) => p.payment_date.slice(0, 7) === monthlyMonth);
    return computeSaleStats(monthSales, monthPayments);
  }, [entries, salePayments, monthlyMonth]);

  const costEntries = useMemo(
    () => entries.filter((e) => e.type === 'expense' && e.cost_section === 'cost').sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries]
  );
  const wageEntries = useMemo(
    () => entries.filter((e) => e.type === 'expense' && e.cost_section === 'wage').sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries]
  );

  const openDebts = useMemo(
    () => entries.filter((e) => e.type === 'debt' && e.status !== 'settled').sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries]
  );

  const debtActivity = useMemo(() => {
    const start = debtStartDate;
    const end = debtEndDate < debtStartDate ? debtStartDate : debtEndDate;
    const periodDebts = entries.filter((e) => e.type === 'debt' && e.entry_date >= start && e.entry_date <= end);
    const newOwedToMe = periodDebts.filter((e) => e.debt_direction !== 'i_owe').reduce((s, e) => s + Number(e.usd), 0);
    const newIOwe = periodDebts.filter((e) => e.debt_direction === 'i_owe').reduce((s, e) => s + Number(e.usd), 0);

    const debtById = {};
    entries.forEach((e) => { if (e.type === 'debt') debtById[e.id] = e; });
    const periodPayments = salePayments.filter((p) => p.payment_date >= start && p.payment_date <= end && debtById[p.entry_id]);
    const collectedOwedToMe = periodPayments
      .filter((p) => debtById[p.entry_id].debt_direction !== 'i_owe')
      .reduce((s, p) => s + Number(p.usd), 0);
    const paidIOwe = periodPayments
      .filter((p) => debtById[p.entry_id].debt_direction === 'i_owe')
      .reduce((s, p) => s + Number(p.usd), 0);

    return { transactions: periodDebts.length, newOwedToMe, newIOwe, collectedOwedToMe, paidIOwe };
  }, [entries, salePayments, debtStartDate, debtEndDate]);

  const goalCards = useMemo(() => {
    return goals.map((g) => {
      const achieved = computeAchieved(g, entries);
      const target = Number(g.target_usd);
      const pct = target > 0 ? Math.max(0, Math.min(100, (achieved / target) * 100)) : 0;
      const remaining = Math.max(0, target - achieved);
      const { start, end } = periodRange(g.period);
      return { ...g, achieved, target, pct, remaining, met: achieved >= target, start, end };
    });
  }, [goals, entries]);

  useEffect(() => {
    if (monthGroups.length > 0 && !monthGroups.some((g) => g.month === expandedMonth)) {
      setExpandedMonth(monthGroups[0].month);
    }
  }, [monthGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !canAdd && tab === 'add') setTab('ledger');
  }, [canAdd, loading, tab]);

  if (session === undefined || loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>;
  }

  if (useRoles && !role) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 360, width: '100%', border: '1px solid var(--paper-line)', borderRadius: 6, padding: 28, background: 'var(--card)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>
            Ledger No. 02
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>Enter your PIN</h1>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
            This account is shared. Your PIN determines what you can see and do.
          </p>
          <form onSubmit={checkPin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
              style={{ textAlign: 'center', fontSize: 18, letterSpacing: '0.2em' }}
            />
            {pinError && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{pinError}</div>}
            <button type="submit" disabled={checkingPin} style={{
              padding: '11px 16px', border: 'none', borderRadius: 4,
              background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: checkingPin ? 0.6 : 1,
            }}>
              {checkingPin ? 'Checking…' : 'Continue'}
            </button>
          </form>
          <button onClick={signOut} style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--slate)', fontSize: 12, textDecoration: 'underline' }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #3F6E52, #B8894C, #B0463F, #4C7A9E)' }} />
      <header style={{ borderBottom: '1px solid var(--paper-line)', padding: '26px 24px 18px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>
              Ledger No. 02
            </div>
            <h1 style={{ fontSize: 30 }}>The Running Account</h1>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--slate)', textAlign: 'right' }}>
            {session.user.email}<br />
            {useRoles && role && <span style={{ color: '#8A6BA8', textTransform: 'capitalize' }}>{role} · </span>}
            {isAdmin && <Link href="/admin" style={{ color: 'var(--gold)' }}>Admin view</Link>}
            {isAdmin && ' · '}
            {useRoles && (
              <>
                <button onClick={switchRole} style={{ background: 'none', border: 'none', color: 'var(--slate)', textDecoration: 'underline', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: 0 }}>
                  Switch role
                </button>
                {' · '}
              </>
            )}
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--slate)', textDecoration: 'underline', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: 0 }}>
              Sign out
            </button>
          </div>
        </div>

        <nav style={{ maxWidth: 1080, margin: '20px auto 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            ...(canAdd ? [{ key: 'add', label: 'Add entry' }] : []),
            { key: 'ledger', label: 'Ledger' },
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'daily', label: 'Report' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'costs', label: '360 Cell Costs' },
            { key: 'wages', label: 'Wages' },
            { key: 'debts', label: 'Debts' },
            ...(plan === 'business' ? [{ key: 'goals', label: 'Goals' }] : []),
          ].map((t) => (
            <button key={t.key} onClick={() => { if (t.key === 'add') cancelEditEntry(); setTab(t.key); }} style={{
              padding: '9px 16px', border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--ink)' : 'transparent',
              color: tab === t.key ? 'var(--paper)' : 'var(--slate)',
              fontWeight: 500, borderRadius: '3px 3px 0 0',
            }}>
              {t.label}
            </button>
          ))}
          <button onClick={exportCSV} disabled={entries.length === 0} style={{
            padding: '9px 16px', border: 'none', background: 'transparent',
            color: entries.length === 0 ? 'var(--paper-line)' : 'var(--gold)',
            fontWeight: 500, marginLeft: 'auto', cursor: entries.length === 0 ? 'default' : 'pointer',
          }}>
            Export CSV
          </button>
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 80px' }}>
        {loadError && (
          <div style={{ background: '#FBEAE8', border: '1px solid var(--coral)', color: 'var(--coral)', borderRadius: 4, padding: '12px 16px', fontSize: 13, marginBottom: 24 }}>
            Could not load your entries: {loadError}
          </div>
        )}

        {tab === 'add' && (
          <div style={{ maxWidth: 560 }}>
            <p style={{ color: 'var(--slate)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
              {editingEntryId
                ? 'Editing this entry — change what needs updating and save.'
                : 'Log what moved today — income, a purchase, an investment, a sale, or debt.'}
            </p>
            <form onSubmit={addEntry} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TYPES.map((t) => (
                  <button type="button" key={t.key} disabled={!!editingEntryId}
                    onClick={() => setForm((f) => ({ ...f, type: t.key, category: '', product: '', cost: '', receivedNow: '', supplier: '', paymentMethod: 'Cash' }))} style={{
                    padding: '8px 14px', borderRadius: 20, cursor: editingEntryId ? 'default' : 'pointer',
                    border: `1.5px solid ${form.type === t.key ? t.color : 'var(--paper-line)'}`,
                    background: form.type === t.key ? t.color + '1a' : 'transparent',
                    color: form.type === t.key ? t.color : 'var(--slate)', fontWeight: 600, fontSize: 13,
                    opacity: editingEntryId && form.type !== t.key ? 0.4 : 1,
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Date
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
              </label>

              {form.type === 'debt' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { key: 'owed_to_me', label: 'Owed to me' },
                    { key: 'i_owe', label: 'I owe' },
                  ].map((d) => (
                    <button type="button" key={d.key} onClick={() => setForm((f) => ({ ...f, debtDirection: d.key }))} style={{
                      flex: 1, padding: '10px 12px', borderRadius: 4, cursor: 'pointer',
                      border: `1.5px solid ${form.debtDirection === d.key ? '#8A6BA8' : 'var(--paper-line)'}`,
                      background: form.debtDirection === d.key ? '#8A6BA81a' : 'transparent',
                      color: form.debtDirection === d.key ? '#8A6BA8' : 'var(--slate)', fontWeight: 600, fontSize: 13,
                    }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              )}

              {useRoles && role === 'admin' && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--slate)',
                  border: '1px solid var(--paper-line)', borderRadius: 4, padding: '10px 12px', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={form.private}
                    onChange={(e) => setForm((f) => ({ ...f, private: e.target.checked }))}
                    style={{ width: 'auto' }}
                  />
                  <span>Private — only visible to Admin</span>
                </label>
              )}

              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Category
                <input list="cat-suggestions" placeholder="e.g. Rent, Stocks, Salary" value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ marginTop: 6 }} />
                <datalist id="cat-suggestions">
                  {CATEGORY_SUGGESTIONS[form.type].map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>

              {form.type === 'sale' && (
                <>
                  <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Product / service sold
                    <input placeholder="e.g. 11GB uShare, iPhone case" value={form.product}
                      onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Bought from (supplier, optional)
                    <input placeholder="e.g. Alfa distributor" value={form.supplier}
                      onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                </>
              )}

              {form.type === 'investment' && (
                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Bought from (supplier, optional)
                  <input placeholder="e.g. Alfa distributor" value={form.supplier}
                    onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
              )}

              {form.type === 'investment' && editingEntryId && editingEntryStatus === 'sold' && (
                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Sold to (optional)
                  <input placeholder="e.g. Karim" value={form.where}
                    onChange={(e) => setForm((f) => ({ ...f, where: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
              )}

              {form.type !== 'investment' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, marginBottom: 6 }}>
                    {form.type === 'sale' ? 'Sold to (customer)' : 'Customer'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      flex: 1, padding: '10px 12px', border: '1px solid var(--paper-line)', borderRadius: 4,
                      fontSize: 14, color: form.customerId ? 'var(--ink)' : 'var(--slate)', background: 'var(--card)',
                    }}>
                      {form.where || 'No customer selected'}
                    </div>
                    <button type="button" onClick={() => setCustomerModalOpen(true)} style={{
                      padding: '10px 14px', border: '1px solid var(--paper-line)', borderRadius: 4,
                      background: 'transparent', color: 'var(--ink)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                    }}>
                      Select customer
                    </button>
                    {form.customerId && (
                      <button type="button" onClick={clearCustomer} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 18, padding: '0 4px' }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  {form.type === 'sale' ? 'Selling price' : 'Amount'}
                  <input type="number" step="any" min="0" placeholder="0" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} />
                </label>
                <label style={{ width: 110, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Currency
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                    <option value="LBP">LBP</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              {form.type === 'sale' && (
                <>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                      Cost to you
                      <input type="number" step="any" min="0" placeholder="0" value={form.cost}
                        onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} style={{ marginTop: 6 }} />
                    </label>
                    {!editingEntryId && (
                      <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                        Received now (optional)
                        <input type="number" step="any" min="0" placeholder="defaults to full amount" value={form.receivedNow}
                          onChange={(e) => setForm((f) => ({ ...f, receivedNow: e.target.value }))} style={{ marginTop: 6 }} />
                      </label>
                    )}
                  </div>
                  {editingEntryId && (
                    <p style={{ fontSize: 12, color: 'var(--slate)', margin: 0 }}>
                      Payments already received aren't changed here — use "Record payment" on the Ledger row for that.
                    </p>
                  )}
                  <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Payment method
                    <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} style={{ marginTop: 6 }}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  {form.amount && form.cost !== '' && !Number.isNaN(parseFloat(form.amount)) && !Number.isNaN(parseFloat(form.cost)) && (
                    (() => {
                      const price = parseFloat(form.amount);
                      const cost = parseFloat(form.cost);
                      const profit = price - cost;
                      const margin = price > 0 ? (profit / price) * 100 : 0;
                      return (
                        <div style={{ fontSize: 13, color: profit >= 0 ? 'var(--green)' : 'var(--coral)', fontWeight: 600 }}>
                          Profit: {profit.toLocaleString('en-US', { maximumFractionDigits: 2 })} {form.currency} ({margin.toFixed(1)}% margin)
                        </div>
                      );
                    })()
                  )}
                </>
              )}

              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Notes (optional)
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ marginTop: 6 }} />
              </label>

              {formError && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{formError}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {editingEntryId && (
                  <button type="button" onClick={cancelEditEntry} style={{
                    flex: 1, padding: '12px 20px', border: '1px solid var(--paper-line)', borderRadius: 4,
                    background: 'transparent', color: 'var(--slate)', fontWeight: 600,
                  }}>
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={saving} style={{
                  flex: 1, padding: '12px 20px', border: 'none', borderRadius: 4,
                  background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? 'Saving…' : editingEntryId ? 'Save changes' : 'Add to ledger'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === 'ledger' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <p style={{ color: 'var(--slate)', fontSize: 14, margin: 0 }}>Grouped by month — tap a month to see its entries.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search category, notes, where…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: 220, padding: '7px 30px 7px 10px', fontSize: 13 }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--slate)', fontSize: 15, lineHeight: 1, padding: 4, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 'auto', padding: '7px 10px', fontSize: 13 }}>
                  <option value="all">All types</option>
                  {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {monthGroups.length === 0 ? (
              <EmptyState onAdd={() => setTab('add')} filtered={entries.length > 0} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {monthGroups.map((g) => {
                  const isOpen = expandedMonth === g.month;
                  const catMap = {};
                  g.entries.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.usd); });
                  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
                  return (
                    <div key={g.month} style={{ border: '1px solid var(--paper-line)', borderRadius: 4, overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedMonth(isOpen ? null : g.month)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 16, padding: '14px 18px', background: isOpen ? 'var(--card)' : 'transparent',
                          border: 'none', textAlign: 'left', flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 17 }}>{monthLabel(g.month)}</span>
                          <span style={{ color: 'var(--slate)', fontSize: 12 }}>{g.entries.length} {g.entries.length === 1 ? 'entry' : 'entries'}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13 }}>
                          <span style={{ color: 'var(--green)' }}>+{fmtUSD(g.income + g.sale)}</span>
                          <span style={{ color: 'var(--coral)' }}>-{fmtUSD(g.expense + g.investment)}</span>
                          <span style={{ fontWeight: 700, color: g.net >= 0 ? 'var(--green)' : 'var(--coral)' }}>{fmtUSD(g.net)}</span>
                          <span style={{ color: 'var(--slate)' }}>{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </button>

                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--paper-line)' }}>
                          {catData.length > 0 && (
                            <div style={{ padding: '16px 18px 0' }}>
                              <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name }) => name}>
                                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip formatter={(v) => fmtUSD(v)} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <div style={{ overflow: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  {['Date', 'Type', 'Category', 'Where', 'LBP', 'USD', 'Notes', ''].map((h) => <th key={h}>{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {g.entries.map((e) => {
                                  const typeInfo = TYPES.find((t) => t.key === e.type) || TYPES.find((t) => t.key === 'sale');
                                  const isActiveAsset = e.type === 'investment' && e.status === 'active';
                                  const isSoldAsset = e.type === 'investment' && e.status === 'sold';
                                  const isActiveDebt = e.type === 'debt' && e.status !== 'settled';
                                  const assetProfit = isSoldAsset ? Number(e.sold_usd) - Number(e.usd) : null;
                                  const isDirectSale = e.type === 'sale' && !!e.product;
                                  const saleBalanceDue = isDirectSale ? Number(e.usd) - Number(e.received_usd || 0) : 0;
                                  const saleStatus = isDirectSale ? saleCollectionStatus(e) : null;
                                  const saleStatusColor = saleStatus === 'Paid' ? 'var(--green)' : saleStatus === 'Partial' ? 'var(--gold)' : 'var(--coral)';
                                  const debtBalanceDue = e.type === 'debt' ? Number(e.usd) - Number(e.received_usd || 0) : 0;
                                  const debtStatus = e.type === 'debt' ? debtCollectionStatus(e) : null;
                                  const debtStatusColor = debtStatus === 'Settled' ? 'var(--green)' : debtStatus === 'Partial' ? 'var(--gold)' : 'var(--coral)';
                                  return (
                                    <tr key={e.id}>
                                      <td>{e.entry_date}</td>
                                      <td><span style={{ color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span></td>
                                      <td>
                                        {e.category}
                                        {e.private && (
                                          <span style={{ marginLeft: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A6BA8', border: '1px solid #8A6BA8', borderRadius: 3, padding: '1px 5px' }}>
                                            Private
                                          </span>
                                        )}
                                        {e.notes && (
                                          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>{e.notes}</div>
                                        )}
                                        {isSoldAsset && (
                                          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                                            Sold {e.sold_date} for {fmtUSD(e.sold_usd)} · <span style={{ color: assetProfit >= 0 ? 'var(--green)' : 'var(--coral)', fontWeight: 600 }}>{assetProfit >= 0 ? '+' : ''}{fmtUSD(assetProfit)}</span>
                                          </div>
                                        )}
                                        {e.type === 'investment' && (e.supplier_text || isSoldAsset) && (
                                          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                                            {e.supplier_text && <>Bought from {e.supplier_text}</>}
                                            {isSoldAsset && <>{e.supplier_text && ' · '}sold to {e.where_text || '—'}</>}
                                          </div>
                                        )}
                                        {e.type === 'debt' && (
                                          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                                            {e.debt_direction === 'i_owe' ? 'I owe' : 'Owed to me'} ·{' '}
                                            <span style={{ color: debtStatusColor, fontWeight: 600 }}>{debtStatus}</span>
                                            {debtBalanceDue > 0.001 && <> · Balance due {fmtUSD(debtBalanceDue)}</>}
                                          </div>
                                        )}
                                        {isDirectSale && (
                                          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                                            {e.product} · Cost {fmtUSD(e.cost_usd)} · <span style={{ color: saleProfitUsd(e) >= 0 ? 'var(--green)' : 'var(--coral)', fontWeight: 600 }}>{saleProfitUsd(e) >= 0 ? '+' : ''}{fmtUSD(saleProfitUsd(e))}</span> ({Number(e.usd) > 0 ? ((saleProfitUsd(e) / Number(e.usd)) * 100).toFixed(1) : '0.0'}% margin)
                                            {e.supplier_text && <><br />Bought from {e.supplier_text} · sold to {e.where_text || '—'}</>}
                                            <br />
                                            <span style={{ color: saleStatusColor, fontWeight: 600 }}>{saleStatus}</span>
                                            {saleBalanceDue > 0.001 && <> · Balance due {fmtUSD(saleBalanceDue)}</>}
                                          </div>
                                        )}
                                      </td>
                                      <td>{e.where_text || '—'}</td>
                                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtLBP(e.lbp)}</td>
                                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(e.usd)}</td>
                                      <td style={{ color: 'var(--slate)' }}>{e.notes || '—'}</td>
                                      <td>
                                        <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                          <button onClick={() => setInvoiceEntry(e)} style={{ background: 'none', border: '1px solid var(--blue)', color: 'var(--blue)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Invoice</button>
                                          {canAdd && isActiveAsset && (
                                            <button onClick={() => openSell(e)} style={{ background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Sell</button>
                                          )}
                                          {canSettleDebt && isActiveDebt && (
                                            <button onClick={() => settleDebt(e)} style={{ background: 'none', border: '1px solid #8A6BA8', color: '#8A6BA8', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Settle</button>
                                          )}
                                          {canSettleDebt && e.type === 'debt' && (
                                            <button onClick={() => openIncreaseDebt(e)} style={{ background: 'none', border: '1px solid #8A6BA8', color: '#8A6BA8', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Add to debt</button>
                                          )}
                                          {canSettleDebt && ((isDirectSale && saleBalanceDue > 0.001) || (isActiveDebt && debtBalanceDue > 0.001)) && (
                                            <button onClick={() => openRecordPayment(e)} style={{ background: 'none', border: '1px solid var(--blue)', color: 'var(--blue)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Record payment</button>
                                          )}
                                          {canDeleteEntry && (
                                            <button onClick={() => startEditEntry(e)} style={{ background: 'none', border: '1px solid var(--paper-line)', color: 'var(--ink)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Edit</button>
                                          )}
                                          {canDeleteEntry && (confirmDeleteId === e.id ? (
                                            <span style={{ display: 'flex', gap: 6 }}>
                                              <button onClick={() => deleteEntry(e.id)} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 11 }}>Delete</button>
                                              <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>×</button>
                                            </span>
                                          ) : (
                                            <button onClick={() => setConfirmDeleteId(e.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>Delete</button>
                                          ))}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'dashboard' && (
          entries.length === 0 ? <EmptyState onAdd={() => setTab('add')} /> : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 32 }}>
              <KpiCard label="Income" value={fmtUSD(totals.income)} color="var(--green)" />
              <KpiCard label="Expenses" value={fmtUSD(totals.expense)} color="var(--coral)" />
              <KpiCard label="Invested" value={fmtUSD(totals.investment)} color="var(--gold)" />
              <KpiCard label="Sale profit" value={fmtUSD(totals.sale)} color="var(--blue)" />
              <KpiCard label="Debt (net)" value={fmtUSD(totals.netDebt)} color={totals.netDebt >= 0 ? 'var(--green)' : 'var(--coral)'} />
              <KpiCard label="Net position" value={fmtUSD(totals.net)} color={totals.net >= 0 ? 'var(--green)' : 'var(--coral)'} bold />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <ChartCard title="Expenses by category">
                {expenseByCategory.length === 0 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name }) => name}>
                        {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard title="Investments by category">
                {investmentByCategory.length === 0 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={investmentByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name }) => name}>
                        {investmentByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard title="Monthly flow">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => fmtUSD(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#3F6E52" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#B0463F" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="investment" name="Investment" fill="#B8894C" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sale" name="Sale profit" fill="#4C7A9E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
              <ChartCard title="Net position over time">
                {trend.length < 2 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                      <Line type="monotone" dataKey="net" name="Net position" stroke="#B8894C" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard title="Income vs. expenses trend">
                {trend.length < 2 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => fmtUSD(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="income" name="Income" stroke="#3F6E52" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="expense" name="Expense" stroke="#B0463F" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </div>
          )
        )}

        {tab === 'daily' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, display: 'block', maxWidth: 220 }}>
                From
                <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} style={{ marginTop: 6 }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, display: 'block', maxWidth: 220 }}>
                To
                <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} style={{ marginTop: 6 }} />
              </label>
            </div>
            <SaleStatsPanel stats={reportStats} />
          </div>
        )}

        {tab === 'monthly' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, display: 'block', marginBottom: 20, maxWidth: 220 }}>
              Report month
              <input type="month" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)} style={{ marginTop: 6 }} />
            </label>
            <SaleStatsPanel stats={monthlyStats} />
          </div>
        )}

        {tab === 'costs' && (
          <RecurringCostSection
            title="360 Cell cost" placeholder="Description" entries={costEntries}
            form={costForm} setForm={setCostForm} error={costError} saving={savingCost}
            onSubmit={() => addRecurringCost('cost', costForm, setCostForm)}
            canAdd={canAdd} canEdit={canDeleteEntry} onEdit={editRecurringCost}
            canDelete={canDeleteEntry} confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId} onDelete={deleteEntry}
          />
        )}

        {tab === 'wages' && (
          <RecurringCostSection
            title="wage" placeholder="Employee name" entries={wageEntries}
            form={wageForm} setForm={setWageForm} error={costError} saving={savingCost}
            onSubmit={() => addRecurringCost('wage', wageForm, setWageForm)}
            canAdd={canAdd} canEdit={canDeleteEntry} onEdit={editRecurringCost}
            canDelete={canDeleteEntry} confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId} onDelete={deleteEntry}
          />
        )}

        {tab === 'debts' && (
          <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, maxWidth: 220 }}>
                From
                <input type="date" value={debtStartDate} onChange={(e) => setDebtStartDate(e.target.value)} style={{ marginTop: 6 }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, maxWidth: 220 }}>
                To
                <input type="date" value={debtEndDate} onChange={(e) => setDebtEndDate(e.target.value)} style={{ marginTop: 6 }} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard label="New — owed to me" value={fmtUSD(debtActivity.newOwedToMe)} color="var(--green)" />
              <KpiCard label="New — I owe" value={fmtUSD(debtActivity.newIOwe)} color="var(--coral)" />
              <KpiCard label="Collected (owed to me)" value={fmtUSD(debtActivity.collectedOwedToMe)} color="var(--green)" />
              <KpiCard label="Paid off (I owe)" value={fmtUSD(debtActivity.paidIOwe)} color="var(--coral)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 32 }}>
              <KpiCard label="Currently owed to me" value={fmtUSD(totals.debtOwedToMe)} color="var(--green)" />
              <KpiCard label="Currently I owe" value={fmtUSD(totals.debtIOwe)} color="var(--coral)" />
              <KpiCard label="Net debt" value={fmtUSD(totals.netDebt)} color={totals.netDebt >= 0 ? 'var(--green)' : 'var(--coral)'} bold />
            </div>

            {canAdd && (
              <ChartCard title="+ Add debt">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Date
                    <input type="date" value={debtForm.date} onChange={(e) => setDebtForm((f) => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <label style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Who
                    <input value={debtForm.who} onChange={(e) => setDebtForm((f) => ({ ...f, who: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { key: 'owed_to_me', label: 'Owed to me' },
                      { key: 'i_owe', label: 'I owe' },
                    ].map((d) => (
                      <button type="button" key={d.key} onClick={() => setDebtForm((f) => ({ ...f, direction: d.key }))} style={{
                        padding: '10px 12px', borderRadius: 4, cursor: 'pointer',
                        border: `1.5px solid ${debtForm.direction === d.key ? '#8A6BA8' : 'var(--paper-line)'}`,
                        background: debtForm.direction === d.key ? '#8A6BA81a' : 'transparent',
                        color: debtForm.direction === d.key ? '#8A6BA8' : 'var(--slate)', fontWeight: 600, fontSize: 13,
                      }}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <label style={{ minWidth: 140, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Category
                    <input list="debt-cat-suggestions" value={debtForm.category} onChange={(e) => setDebtForm((f) => ({ ...f, category: e.target.value }))} style={{ marginTop: 6 }} />
                    <datalist id="debt-cat-suggestions">
                      {CATEGORY_SUGGESTIONS.debt.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </label>
                  <label style={{ width: 120, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Amount
                    <input type="number" step="any" min="0" placeholder="0" value={debtForm.amount} onChange={(e) => setDebtForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <label style={{ width: 100, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Currency
                    <select value={debtForm.currency} onChange={(e) => setDebtForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                      <option value="LBP">LBP</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <label style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Notes (optional)
                    <input value={debtForm.notes} onChange={(e) => setDebtForm((f) => ({ ...f, notes: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <button type="button" onClick={addDebtEntry} disabled={savingDebt} style={{
                    padding: '10px 18px', border: 'none', borderRadius: 4,
                    background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: savingDebt ? 0.6 : 1,
                  }}>
                    {savingDebt ? 'Saving…' : 'Add'}
                  </button>
                </div>
                {debtFormError && <div style={{ color: 'var(--coral)', fontSize: 13, marginTop: 10 }}>{debtFormError}</div>}
              </ChartCard>
            )}

            <div style={{ marginTop: 24, overflow: 'auto' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Open debts</h3>
              {openDebts.length === 0 ? <NoData /> : (
                <table>
                  <thead>
                    <tr>{['Date', 'Who', 'Direction', 'Category', 'Amount', 'Balance due', 'Status', ''].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {openDebts.map((e) => {
                      const balanceDue = Number(e.usd) - Number(e.received_usd || 0);
                      const status = debtCollectionStatus(e);
                      const statusColor = status === 'Settled' ? 'var(--green)' : status === 'Partial' ? 'var(--gold)' : 'var(--coral)';
                      return (
                        <tr key={e.id}>
                          <td>{e.entry_date}</td>
                          <td>{e.where_text || '—'}</td>
                          <td>{e.debt_direction === 'i_owe' ? 'I owe' : 'Owed to me'}</td>
                          <td>{e.category}</td>
                          <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(e.usd)}</td>
                          <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(balanceDue)}</td>
                          <td><span style={{ color: statusColor, fontWeight: 600 }}>{status}</span></td>
                          <td>
                            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {canSettleDebt && (
                                <button onClick={() => settleDebt(e)} style={{ background: 'none', border: '1px solid #8A6BA8', color: '#8A6BA8', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Settle</button>
                              )}
                              {canSettleDebt && (
                                <button onClick={() => openIncreaseDebt(e)} style={{ background: 'none', border: '1px solid #8A6BA8', color: '#8A6BA8', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Add to debt</button>
                              )}
                              {canSettleDebt && balanceDue > 0.001 && (
                                <button onClick={() => openRecordPayment(e)} style={{ background: 'none', border: '1px solid var(--blue)', color: 'var(--blue)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Record payment</button>
                              )}
                              {canDeleteEntry && (
                                <button onClick={() => startEditEntry(e)} style={{ background: 'none', border: '1px solid var(--paper-line)', color: 'var(--ink)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Edit</button>
                              )}
                              {canDeleteEntry && (confirmDeleteId === e.id ? (
                                <span style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => deleteEntry(e.id)} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 11 }}>Delete</button>
                                  <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>×</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(e.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>Delete</button>
                              ))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'goals' && plan === 'business' && (
          <div>
            <p style={{ color: 'var(--slate)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
              Set targets for the current day, week, or month — progress updates automatically from your ledger.
            </p>

            {goalCards.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
                {goalCards.map((g) => (
                  <div key={g.id} style={{ border: '1px solid var(--paper-line)', borderRadius: 4, padding: 18, background: 'var(--card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: 4 }}>
                          {GOAL_PERIODS.find((p) => p.key === g.period)?.label}
                        </div>
                        <h3 style={{ fontSize: 16 }}>{g.label}</h3>
                      </div>
                      {canEdit && <button onClick={() => deleteGoal(g.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 12 }}>Delete</button>}
                    </div>

                    <div style={{ height: 10, background: 'var(--paper-line)', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{
                        height: '100%', width: `${g.pct}%`,
                        background: g.met ? 'var(--green)' : 'var(--gold)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: g.met ? 'var(--green)' : 'var(--ink)' }}>
                        {fmtUSD(g.achieved)}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--slate)' }}>
                        of {fmtUSD(g.target)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--slate)' }}>
                      {g.met
                        ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Target reached</span>
                        : <>{fmtUSD(g.remaining)} to go</>}
                      {' · '}{g.start === g.end ? g.start : `${g.start} – ${g.end}`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
            <div style={{ maxWidth: 480, border: '1px solid var(--paper-line)', borderRadius: 4, padding: 20, background: 'var(--card)' }}>
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>Add a target</h3>
              <form onSubmit={addGoal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Label
                  <input placeholder="e.g. Weekly sales target" value={goalForm.label}
                    onChange={(e) => setGoalForm((f) => ({ ...f, label: e.target.value }))} style={{ marginTop: 6 }} />
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  {GOAL_PERIODS.map((p) => (
                    <button type="button" key={p.key} onClick={() => setGoalForm((f) => ({ ...f, period: p.key }))} style={{
                      flex: 1, padding: '8px 10px', borderRadius: 20, cursor: 'pointer',
                      border: `1.5px solid ${goalForm.period === p.key ? 'var(--gold)' : 'var(--paper-line)'}`,
                      background: goalForm.period === p.key ? 'var(--gold)1a' : 'transparent',
                      color: goalForm.period === p.key ? 'var(--gold)' : 'var(--slate)', fontWeight: 600, fontSize: 13,
                    }}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                  Counts toward this goal
                  <select value={goalForm.metric} onChange={(e) => setGoalForm((f) => ({ ...f, metric: e.target.value }))} style={{ marginTop: 6 }}>
                    {GOAL_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </label>

                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Target amount
                    <input type="number" step="any" min="0" placeholder="0" value={goalForm.amount}
                      onChange={(e) => setGoalForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} />
                  </label>
                  <label style={{ width: 110, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                    Currency
                    <select value={goalForm.currency} onChange={(e) => setGoalForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                      <option value="USD">USD</option>
                      <option value="LBP">LBP</option>
                    </select>
                  </label>
                </div>

                {goalError && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{goalError}</div>}

                <button type="submit" disabled={goalSaving} style={{
                  padding: '11px 18px', border: 'none', borderRadius: 4,
                  background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: goalSaving ? 0.6 : 1,
                }}>
                  {goalSaving ? 'Saving…' : 'Add target'}
                </button>
              </form>
            </div>
            )}
          </div>
        )}
      </main>

      {sellingEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,57,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 480, borderRadius: '8px 8px 0 0', padding: '22px 22px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>Sell {sellingEntry.category}</h3>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
              Bought for {fmtUSD(sellingEntry.usd)}. Enter what it sold for — profit or loss logs automatically.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Sale amount
                <input type="number" step="any" min="0" placeholder="0" value={sellForm.amount}
                  onChange={(e) => setSellForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} autoFocus />
              </label>
              <label style={{ width: 110, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Currency
                <select value={sellForm.currency} onChange={(e) => setSellForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </select>
              </label>
            </div>
            <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, display: 'block', marginBottom: 14 }}>
              Sale date
              <input type="date" value={sellForm.date} onChange={(e) => setSellForm((f) => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500, display: 'block', marginBottom: 14 }}>
              Sold to (optional)
              <input placeholder="e.g. Karim" value={sellForm.soldTo}
                onChange={(e) => setSellForm((f) => ({ ...f, soldTo: e.target.value }))} style={{ marginTop: 6 }} />
            </label>

            {sellForm.amount && !Number.isNaN(parseFloat(sellForm.amount)) && (
              (() => {
                const { usd: previewUsd } = toUsdLbp(parseFloat(sellForm.amount), sellForm.currency);
                const previewProfit = previewUsd - Number(sellingEntry.usd);
                return (
                  <div style={{ fontSize: 13, marginBottom: 16, color: previewProfit >= 0 ? 'var(--green)' : 'var(--coral)', fontWeight: 600 }}>
                    {previewProfit >= 0 ? 'Profit' : 'Loss'}: {fmtUSD(previewProfit)}
                  </div>
                );
              })()
            )}

            {sellError && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 14 }}>{sellError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSellingEntry(null)} style={{ flex: 1, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4, background: 'transparent', color: 'var(--slate)', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={confirmSell} disabled={selling} style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: selling ? 0.6 : 1 }}>
                {selling ? 'Saving…' : 'Confirm sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payingEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,57,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 480, borderRadius: '8px 8px 0 0', padding: '22px 22px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>Record payment — {payingEntry.product || payingEntry.category}</h3>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
              Balance due: {fmtUSD(Number(payingEntry.usd) - Number(payingEntry.received_usd || 0))}
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Amount received
                <input type="number" step="any" min="0" placeholder="0" value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} autoFocus />
              </label>
              <label style={{ width: 110, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Currency
                <select value={payForm.currency} onChange={(e) => setPayForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Payment method
                <select value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} style={{ marginTop: 6 }}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Date
                <input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
              </label>
            </div>

            {payError && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 14 }}>{payError}</div>}

            {salePayments.filter((p) => p.entry_id === payingEntry.id).length > 0 && (
              <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, marginBottom: 14, maxHeight: 140, overflowY: 'auto' }}>
                {salePayments
                  .filter((p) => p.entry_id === payingEntry.id)
                  .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                  .map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--paper-line)' }}>
                      <span style={{ color: 'var(--slate)' }}>{p.payment_date}{p.payment_method ? ` · ${p.payment_method}` : ''}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(p.usd)}</span>
                    </div>
                  ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPayingEntry(null)} style={{ flex: 1, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4, background: 'transparent', color: 'var(--slate)', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={confirmRecordPayment} disabled={paying} style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: paying ? 0.6 : 1 }}>
                {paying ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {increasingDebt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,57,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 480, borderRadius: '8px 8px 0 0', padding: '22px 22px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>Add to debt — {increasingDebt.category}</h3>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
              Current amount: {fmtUSD(increasingDebt.usd)}
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <label style={{ flex: 1, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Amount to add
                <input type="number" step="any" min="0" placeholder="0" value={increaseForm.amount}
                  onChange={(e) => setIncreaseForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} autoFocus />
              </label>
              <label style={{ width: 110, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
                Currency
                <select value={increaseForm.currency} onChange={(e) => setIncreaseForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </select>
              </label>
            </div>

            {increaseForm.amount && !Number.isNaN(parseFloat(increaseForm.amount)) && (
              (() => {
                const { usd: addedUsd } = toUsdLbp(parseFloat(increaseForm.amount), increaseForm.currency);
                return (
                  <div style={{ fontSize: 13, marginBottom: 16, color: 'var(--slate)' }}>
                    New total: {fmtUSD(Number(increasingDebt.usd) + addedUsd)}
                  </div>
                );
              })()
            )}

            {increaseError && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 14 }}>{increaseError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setIncreasingDebt(null)} style={{ flex: 1, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4, background: 'transparent', color: 'var(--slate)', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={confirmIncreaseDebt} disabled={increasing} style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: increasing ? 0.6 : 1 }}>
                {increasing ? 'Saving…' : 'Add to debt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceEntry && (
        <div className="invoice-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,57,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <style>{`
            @media print {
              @page { margin: 10mm; }
              html, body { height: auto !important; }
              body * { visibility: hidden; }
              .invoice-print, .invoice-print * { visibility: visible; }
              .invoice-print {
                position: absolute; inset: 0 auto auto 0; margin: 0; box-shadow: none !important; border-radius: 0 !important;
                width: 100% !important; max-width: 100% !important; max-height: none !important; overflow: visible !important;
              }
              .invoice-overlay { position: static !important; background: none !important; padding: 0 !important; display: block !important; }
              .no-print { display: none !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            }
          `}</style>
          <div className="invoice-print" style={{
            background: '#fff', width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto',
            borderRadius: 6, position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }}>
            {/* Top diagonal teal band */}
            <div style={{
              position: 'relative', padding: '32px 36px 26px',
              background: 'linear-gradient(120deg, #cdeee3 0%, #a9d9dd 55%, #8fcbe0 100%)',
              clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h1 style={{ fontSize: 30, fontWeight: 800, color: '#12202b', letterSpacing: '0.01em' }}>INVOICE</h1>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: "'Source Serif 4', serif", fontStyle: 'italic', fontWeight: 800, fontSize: 22, background: 'linear-gradient(120deg, #1f5fa8, #5fb8d9)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>360</span>
                    <span style={{ fontFamily: "'Source Serif 4', serif", fontStyle: 'italic', fontWeight: 700, fontSize: 19, color: '#12202b' }}>CELL</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#12202b', marginTop: 6 }}>Phone: +961 81 055 797</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 48, marginTop: 22 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#12202b' }}>DATE</div>
                  <div style={{ fontSize: 14, color: '#12202b', marginTop: 2 }}>{invoiceDateStr(invoiceEntry.entry_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#12202b' }}>INVOICE NO</div>
                  <div style={{ fontSize: 14, color: '#12202b', marginTop: 2 }}>{invoiceNumber(invoiceEntry)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#12202b' }}>Bought from:</div>
                  <div style={{ fontSize: 13, color: '#12202b', marginTop: 2 }}>
                    {(invoiceEntry.type === 'sale' || invoiceEntry.type === 'investment')
                      ? (invoiceEntry.supplier_text || '—')
                      : (BOUGHT_FROM_TYPES.includes(invoiceEntry.type) || (invoiceEntry.type === 'debt' && invoiceEntry.debt_direction === 'i_owe')) ? (invoiceEntry.where_text || '—') : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#12202b' }}>Sold to:</div>
                  <div style={{ fontSize: 13, color: '#12202b', marginTop: 2 }}>
                    {invoiceEntry.type === 'investment'
                      ? (invoiceEntry.status === 'sold' ? (invoiceEntry.where_text || '—') : '')
                      : (!BOUGHT_FROM_TYPES.includes(invoiceEntry.type) && !(invoiceEntry.type === 'debt' && invoiceEntry.debt_direction === 'i_owe')) ? (invoiceEntry.where_text || '—') : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '10px 36px 30px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #c7c7c7', marginTop: 18 }}>
                <div style={{ padding: '10px 12px', borderRight: '1px solid #c7c7c7' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#12202b' }}>TYPE</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{TYPES.find((t) => t.key === invoiceEntry.type)?.label}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRight: '1px solid #c7c7c7' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#12202b' }}>CATEGORY</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{invoiceEntry.category}</div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#12202b' }}>DUE DATE</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{invoiceDateStr(invoiceEntry.entry_date)}</div>
                </div>
              </div>

              {(() => {
                const breakdown = invoiceProfitBreakdown(invoiceEntry);
                if (!breakdown) return null;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #c7c7c7', borderTop: 'none' }}>
                    <div style={{ padding: '10px 12px', borderRight: '1px solid #c7c7c7' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#12202b' }}>BOUGHT FOR</div>
                      <div style={{ fontSize: 13, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(breakdown.boughtFor)}</div>
                    </div>
                    <div style={{ padding: '10px 12px', borderRight: '1px solid #c7c7c7' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#12202b' }}>SOLD FOR</div>
                      <div style={{ fontSize: 13, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(breakdown.soldFor)}</div>
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#12202b' }}>PROFIT</div>
                      <div style={{ fontSize: 13, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: breakdown.profit >= 0 ? '#1c6b52' : '#b0463f' }}>
                        {breakdown.profit >= 0 ? '+' : ''}{fmtUSD(breakdown.profit)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <table style={{ width: '100%', marginTop: 26, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #12202b' }}>
                    <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#1c6b52', padding: '0 0 8px' }}>SERIAL NUMBER</th>
                    <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#1c6b52', padding: '0 0 8px' }}>DESCRIPTION</th>
                    <th style={{ textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#1c6b52', padding: '0 0 8px' }}>UNIT PRICE</th>
                    <th style={{ textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#1c6b52', padding: '0 0 8px' }}>LINE TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 0', fontSize: 13, color: '#12202b' }}>{invoiceEntry.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: '10px 0', fontSize: 13, color: '#12202b' }}>{invoiceEntry.category}{invoiceEntry.notes ? ` — ${invoiceEntry.notes}` : ''}</td>
                    <td style={{ padding: '10px 0', fontSize: 13, color: '#12202b', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(invoiceEntry.usd)}</td>
                    <td style={{ padding: '10px 0', fontSize: 13, color: '#12202b', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(invoiceEntry.usd)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26 }}>
                <div style={{ width: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                    <span>Subtotal</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(invoiceEntry.usd)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                    <span>Sales Tax</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, fontWeight: 700, borderTop: '1px solid #12202b', marginTop: 4 }}>
                    <span>Total</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(invoiceEntry.usd)}</span>
                  </div>
                </div>
              </div>

              <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 30 }}>
                <button onClick={() => setInvoiceEntry(null)} style={{ flex: 1, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4, background: 'transparent', color: 'var(--slate)', fontWeight: 600 }}>
                  Close
                </button>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600 }}>
                  Print / Save as PDF
                </button>
              </div>
            </div>

            {/* Bottom diagonal accent */}
            <div style={{
              height: 26,
              background: 'linear-gradient(120deg, #cdeee3 0%, #a9d9dd 55%, #8fcbe0 100%)',
              clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 100%)',
            }} />
          </div>
        </div>
      )}

      {customerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,57,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 55 }}>
          <div style={{ background: 'var(--card)', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', borderRadius: '8px 8px 0 0', padding: '22px 22px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, marginBottom: 16 }}>Select customer</h3>

            <input
              type="text"
              placeholder="Search by name or code…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              autoFocus
              style={{ marginBottom: 14 }}
            />

            <div style={{ maxHeight: 220, overflowY: 'auto', border: customers.length ? '1px solid var(--paper-line)' : 'none', borderRadius: 4, marginBottom: 20 }}>
              {customers
                .filter((c) => {
                  const q = customerSearch.trim().toLowerCase();
                  if (!q) return true;
                  return c.name.toLowerCase().includes(q) || c.code.includes(q);
                })
                .map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--paper-line)' }}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(c)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1,
                        padding: '10px 12px', background: 'transparent', border: 'none',
                        textAlign: 'left', cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.name}
                        {c.type && (
                          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--slate)', border: '1px solid var(--paper-line)', borderRadius: 3, padding: '1px 5px' }}>
                            {CUSTOMER_TYPES.find((t) => t.key === c.type)?.label || c.type}
                          </span>
                        )}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--gold)' }}>{c.code}</span>
                    </button>
                    {canAdd && (
                      <button type="button" onClick={() => openEditCustomer(c)} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 12, padding: '10px 12px', cursor: 'pointer' }}>
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              {customers.length > 0 && customers.filter((c) => {
                const q = customerSearch.trim().toLowerCase();
                if (!q) return true;
                return c.name.toLowerCase().includes(q) || c.code.includes(q);
              }).length === 0 && (
                <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--slate)' }}>No matches.</div>
              )}
              {customers.length === 0 && (
                <div style={{ padding: '4px 0 14px', fontSize: 13, color: 'var(--slate)' }}>No customers yet — create the first one below.</div>
              )}
            </div>

            {editingCustomer ? (
              <div style={{ borderTop: '1px solid var(--paper-line)', paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 12 }}>Edit customer — {editingCustomer.code}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input placeholder="Name" value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} />
                  <input placeholder="Phone number" value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    {CUSTOMER_TYPES.map((t) => (
                      <button type="button" key={t.key} onClick={() => setEditCustomerType(t.key)} style={{
                        flex: 1, padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                        border: `1.5px solid ${editCustomerType === t.key ? 'var(--ink)' : 'var(--paper-line)'}`,
                        background: editCustomerType === t.key ? 'var(--ink)' : 'transparent',
                        color: editCustomerType === t.key ? 'var(--paper)' : 'var(--slate)', fontWeight: 600, fontSize: 12,
                      }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {editCustomerError && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{editCustomerError}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={cancelEditCustomer} style={{
                      flex: 1, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4,
                      background: 'transparent', color: 'var(--slate)', fontWeight: 600,
                    }}>
                      Cancel
                    </button>
                    <button type="button" onClick={saveEditCustomer} disabled={savingCustomerEdit} style={{
                      flex: 1, padding: '11px 16px', border: 'none', borderRadius: 4,
                      background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: savingCustomerEdit ? 0.6 : 1,
                    }}>
                      {savingCustomerEdit ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--paper-line)', paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 12 }}>+ New customer</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input placeholder="Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                  <input placeholder="Phone number" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    {CUSTOMER_TYPES.map((t) => (
                      <button type="button" key={t.key} onClick={() => setNewCustomerType(t.key)} style={{
                        flex: 1, padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                        border: `1.5px solid ${newCustomerType === t.key ? 'var(--ink)' : 'var(--paper-line)'}`,
                        background: newCustomerType === t.key ? 'var(--ink)' : 'transparent',
                        color: newCustomerType === t.key ? 'var(--paper)' : 'var(--slate)', fontWeight: 600, fontSize: 12,
                      }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {customerError && <div style={{ color: 'var(--coral)', fontSize: 13 }}>{customerError}</div>}
                  <button type="button" onClick={createCustomer} disabled={creatingCustomer} style={{
                    padding: '11px 16px', border: 'none', borderRadius: 4,
                    background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: creatingCustomer ? 0.6 : 1,
                  }}>
                    {creatingCustomer ? 'Creating…' : 'Create customer'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setCustomerModalOpen(false); setCustomerSearch(''); setCustomerError(''); setEditingCustomer(null); }}
              style={{ width: '100%', marginTop: 16, padding: '11px 16px', border: '1px solid var(--paper-line)', borderRadius: 4, background: 'transparent', color: 'var(--slate)', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SaleStatsPanel({ stats }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 32 }}>
        <KpiCard label="Transactions" value={stats.transactions} color="var(--ink)" />
        <KpiCard label="Revenue" value={fmtUSD(stats.revenue)} color="var(--green)" />
        <KpiCard label="Cost" value={fmtUSD(stats.cost)} color="var(--coral)" />
        <KpiCard label="Gross profit" value={fmtUSD(stats.grossProfit)} color="var(--blue)" bold />
        <KpiCard label="Gross margin" value={`${(stats.grossMargin * 100).toFixed(1)}%`} color="var(--gold)" />
        <KpiCard label="Avg profit / sale" value={fmtUSD(stats.avgProfitPerSale)} color="var(--blue)" />
        <KpiCard label="Amount collected" value={fmtUSD(stats.collected)} color="var(--green)" />
        <KpiCard label="Open receivables" value={fmtUSD(stats.openReceivables)} color={stats.openReceivables > 0 ? 'var(--coral)' : 'var(--green)'} />
        <KpiCard label="Collection rate" value={`${(stats.collectionRate * 100).toFixed(1)}%`} color="var(--gold)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <KpiCard label="Best category" value={stats.bestCategory ? stats.bestCategory.category : '—'} color="var(--green)" />
        <KpiCard label="Needs attention" value={stats.worstCategory ? stats.worstCategory.category : '—'} color="var(--coral)" />
      </div>

      <ChartCard title="By category">
        {stats.categories.length === 0 ? <NoData /> : (
          <div style={{ overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {['Category', 'Transactions', 'Revenue', 'Profit', 'Margin', 'Open balance'].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {stats.categories.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td>{c.transactions}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(c.revenue)}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace", color: c.profit >= 0 ? 'var(--green)' : 'var(--coral)' }}>{fmtUSD(c.profit)}</td>
                    <td>{(c.margin * 100).toFixed(1)}%</td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(c.openBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </>
  );
}

function RecurringCostSection({
  title, placeholder, entries, form, setForm, error, saving, onSubmit,
  canAdd, canEdit, onEdit, canDelete, confirmDeleteId, setConfirmDeleteId, onDelete,
}) {
  const monthlyTotal = entries.filter((e) => e.recurrence === 'monthly').reduce((s, e) => s + Number(e.usd), 0);
  const weeklyTotal = entries.filter((e) => e.recurrence === 'weekly').reduce((s, e) => s + Number(e.usd), 0);
  const onceTotal = entries.filter((e) => e.recurrence === 'once').reduce((s, e) => s + Number(e.usd), 0);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const beginEdit = (e) => {
    setEditingId(e.id);
    setEditForm({
      date: e.entry_date,
      description: e.category || '',
      amount: String(e.amount_raw),
      currency: e.currency || 'LBP',
      frequency: e.recurrence || 'monthly',
    });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditError('');
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    const result = await onEdit(editingId, editForm);
    setSavingEdit(false);
    if (result?.error) { setEditError(result.error); return; }
    cancelEdit();
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Monthly total" value={fmtUSD(monthlyTotal)} color="var(--coral)" />
        <KpiCard label="Weekly total" value={fmtUSD(weeklyTotal)} color="var(--coral)" />
        <KpiCard label="One-time total" value={fmtUSD(onceTotal)} color="var(--coral)" />
      </div>

      {canAdd && (
      <ChartCard title={`+ Add ${title.toLowerCase()}`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
          </label>
          <label style={{ flex: 1, minWidth: 180, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            {placeholder}
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ marginTop: 6 }} />
          </label>
          <label style={{ width: 120, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            Amount
            <input type="number" step="any" min="0" placeholder="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ marginTop: 6 }} />
          </label>
          <label style={{ width: 100, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            Currency
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} style={{ marginTop: 6 }}>
              <option value="LBP">LBP</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label style={{ width: 130, fontSize: 12, color: 'var(--slate)', fontWeight: 500 }}>
            Frequency
            <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} style={{ marginTop: 6 }}>
              {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={onSubmit} disabled={saving} style={{
            padding: '10px 18px', border: 'none', borderRadius: 4,
            background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--coral)', fontSize: 13, marginTop: 10 }}>{error}</div>}
      </ChartCard>
      )}

      <div style={{ marginTop: 24, overflow: 'auto' }}>
        {entries.length === 0 ? <NoData /> : (
          <table>
            <thead>
              <tr>{['Date', 'Description', 'Frequency', 'Amount', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  {editingId === e.id ? (
                    <>
                      <td>
                        <input type="date" value={editForm.date} onChange={(ev) => setEditForm((f) => ({ ...f, date: ev.target.value }))} style={{ width: 130 }} />
                      </td>
                      <td>
                        <input value={editForm.description} onChange={(ev) => setEditForm((f) => ({ ...f, description: ev.target.value }))} style={{ width: 150 }} />
                      </td>
                      <td>
                        <select value={editForm.frequency} onChange={(ev) => setEditForm((f) => ({ ...f, frequency: ev.target.value }))}>
                          {FREQUENCIES.map((fr) => <option key={fr.key} value={fr.key}>{fr.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: 4 }}>
                          <input type="number" step="any" min="0" value={editForm.amount} onChange={(ev) => setEditForm((f) => ({ ...f, amount: ev.target.value }))} style={{ width: 90 }} />
                          <select value={editForm.currency} onChange={(ev) => setEditForm((f) => ({ ...f, currency: ev.target.value }))} style={{ width: 70 }}>
                            <option value="LBP">LBP</option>
                            <option value="USD">USD</option>
                          </select>
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={saveEdit} disabled={savingEdit} style={{ background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600, opacity: savingEdit ? 0.6 : 1 }}>
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit} style={{ background: 'none', border: '1px solid var(--paper-line)', color: 'var(--ink)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Cancel</button>
                        </span>
                        {editError && <div style={{ color: 'var(--coral)', fontSize: 11, marginTop: 4 }}>{editError}</div>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{e.entry_date}</td>
                      <td>{e.category}</td>
                      <td style={{ textTransform: 'capitalize' }}>{e.recurrence || '—'}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtUSD(e.usd)}</td>
                      <td>
                        <span style={{ display: 'flex', gap: 6 }}>
                          {canEdit && <button onClick={() => beginEdit(e)} style={{ background: 'none', border: '1px solid var(--paper-line)', color: 'var(--ink)', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>Edit</button>}
                          {canDelete && (confirmDeleteId === e.id ? (
                            <span style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => onDelete(e.id)} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 11 }}>Delete</button>
                              <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>×</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(e.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)' }}>Delete</button>
                          ))}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, bold }) {
  return (
    <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, padding: 16, background: 'var(--card)' }}>
      <div style={{ color: 'var(--slate)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Source Serif 4', serif", fontWeight: bold ? 700 : 600, fontSize: 22, color }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--paper-line)', borderRadius: 4, padding: 18, background: 'var(--card)' }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function NoData() {
  return <div style={{ color: 'var(--slate)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Nothing here yet.</div>;
}

function EmptyState({ onAdd, filtered }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--paper-line)', borderRadius: 4 }}>
      <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 16 }}>
        {filtered ? 'No entries match this filter.' : 'No entries yet. The ledger starts with your first one.'}
      </p>
      {!filtered && (
        <button onClick={onAdd} style={{ padding: '10px 18px', border: 'none', borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600 }}>
          Add your first entry
        </button>
      )}
    </div>
  );
}
