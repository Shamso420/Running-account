-- Enables and correctly scopes Row Level Security on every table the
-- app's client code reads/writes directly: entries, customers, goals,
-- and profiles. These tables predate this migrations folder and were
-- created by hand in the Supabase SQL editor, so there's no tracked
-- record of whether RLS was ever turned on for them.
--
-- This matters because the app's own queries (e.g. the dashboard's
-- `supabase.from('entries').select('*')`) never filter by user_id in
-- the client code — they rely entirely on RLS to scope results to the
-- signed-in user. If RLS is missing or misconfigured on these tables,
-- any signed-in user can read every other user's ledger.
--
-- Every statement here is idempotent (safe to re-run, and safe even if
-- some of this already exists).
-- Run this once in the Supabase SQL editor for this project.

-- Lets a policy check "is the current user an admin" without
-- recursively re-evaluating profiles' own RLS — SECURITY DEFINER runs
-- with the function owner's privileges, which bypasses RLS internally.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- entries: the ledger itself. Admins can read every user's entries
-- (the admin dashboard depends on this), but only the owner can write.
alter table entries enable row level security;

drop policy if exists "entries_select" on entries;
create policy "entries_select" on entries
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists "entries_insert" on entries;
create policy "entries_insert" on entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "entries_update" on entries;
create policy "entries_update" on entries
  for update using (auth.uid() = user_id);

drop policy if exists "entries_delete" on entries;
create policy "entries_delete" on entries
  for delete using (auth.uid() = user_id);

-- customers: invoicing contacts, owner-only.
alter table customers enable row level security;

drop policy if exists "customers_select" on customers;
create policy "customers_select" on customers
  for select using (auth.uid() = user_id);

drop policy if exists "customers_insert" on customers;
create policy "customers_insert" on customers
  for insert with check (auth.uid() = user_id);

drop policy if exists "customers_update" on customers;
create policy "customers_update" on customers
  for update using (auth.uid() = user_id);

drop policy if exists "customers_delete" on customers;
create policy "customers_delete" on customers
  for delete using (auth.uid() = user_id);

-- goals: owner-only.
alter table goals enable row level security;

drop policy if exists "goals_select" on goals;
create policy "goals_select" on goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert" on goals;
create policy "goals_insert" on goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update" on goals;
create policy "goals_update" on goals
  for update using (auth.uid() = user_id);

drop policy if exists "goals_delete" on goals;
create policy "goals_delete" on goals
  for delete using (auth.uid() = user_id);

-- profiles: read-only from the client (writes go through the
-- admin_set_plan / admin_set_role_pin RPCs, which run as SECURITY
-- DEFINER and so don't need their own RLS write policy). Admins can
-- read every profile; everyone else can only read their own.
alter table profiles enable row level security;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (auth.uid() = id or is_admin());
