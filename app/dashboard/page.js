'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { RATE, TYPES, CATEGORY_SUGGESTIONS, fmtUSD, fmtLBP, toUsdLbp } from '../../lib/ledgerUtils';

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  category: '',
  where: '',
  amount: '',
  currency: 'LBP',
  notes: '',
  debtDirection: 'owed_to_me',
});

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
  if (goal.metric === 'profit') return relevant.filter((e) => e.type === 'profit').reduce((s, e) => s + Number(e.usd), 0);
  if (goal.metric === 'income_plus_profit') return relevant.filter((e) => e.type === 'income' || e.type === 'profit').reduce((s, e) => s + Number(e.usd), 0);
  return relevant.reduce((s, e) => {
    if (e.type === 'income' || e.type === 'profit') return s + Number(e.usd);
    if (e.type === 'expense' || e.type === 'investment') return s - Number(e.usd);
    return s;
  }, 0);
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = loading, null = no session
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState('free');
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState({ label: '', period: 'weekly', metric: 'income_plus_profit', amount: '', currency: 'USD' });
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [sellingEntry, setSellingEntry] = useState(null);
  const [sellForm, setSellForm] = useState({ amount: '', currency: 'USD', date: new Date().toISOString().slice(0, 10) });
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
        .select('is_admin, plan')
        .eq('id', session.user.id)
        .single();
      setIsAdmin(!!profile?.is_admin);
      setPlan(profile?.plan || 'free');

      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (error) setLoadError(error.message);
      else setEntries(data || []);

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
    router.replace('/login');
  };

  const addEntry = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setFormError('Enter an amount greater than zero.'); return; }
    if (!form.category.trim()) { setFormError('Enter a category.'); return; }
    setFormError('');
    setSaving(true);
    const { usd, lbp } = toUsdLbp(amt, form.currency);
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: session.user.id,
        entry_date: form.date,
        type: form.type,
        category: form.category.trim(),
        where_text: form.where.trim(),
        notes: form.notes.trim(),
        currency: form.currency,
        amount_raw: amt,
        usd, lbp,
        debt_direction: form.type === 'debt' ? form.debtDirection : null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { setFormError('Could not save: ' + error.message); return; }
    setEntries((prev
