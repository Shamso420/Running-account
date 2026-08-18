-- Adds a payment method field to entries, and a full payment history
-- table for sales (each collection logged as its own dated row, instead
-- of only a running total).
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists payment_method text;

create table if not exists sale_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  payment_date date not null,
  amount_raw numeric not null,
  currency text not null,
  usd numeric not null,
  lbp numeric not null,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table sale_payments enable row level security;

create policy "sale_payments_select_own" on sale_payments
  for select using (auth.uid() = user_id);

create policy "sale_payments_insert_own" on sale_payments
  for insert with check (auth.uid() = user_id);

create policy "sale_payments_update_own" on sale_payments
  for update using (auth.uid() = user_id);

create policy "sale_payments_delete_own" on sale_payments
  for delete using (auth.uid() = user_id);
