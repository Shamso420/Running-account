-- Adds an inventory table (per-product stock levels), plus a quantity
-- column on entries so a Sale can record how many units were sold and
-- automatically deduct that many from inventory when it matches a
-- tracked product name.
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists quantity numeric;

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table inventory enable row level security;

create policy "inventory_select_own" on inventory
  for select using (auth.uid() = user_id);

create policy "inventory_insert_own" on inventory
  for insert with check (auth.uid() = user_id);

create policy "inventory_update_own" on inventory
  for update using (auth.uid() = user_id);

create policy "inventory_delete_own" on inventory
  for delete using (auth.uid() = user_id);
