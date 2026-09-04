-- Adds a per-account list of approved devices/browsers, so logging in
-- only works from devices an admin has approved. The very first device
-- to ever log in for an account is auto-approved (so nobody locks
-- themselves out); every device after that starts pending until an
-- admin approves it from the app.
-- Run this once in the Supabase SQL editor for this project.

create table if not exists approved_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table approved_devices enable row level security;

drop policy if exists "select own devices" on approved_devices;
create policy "select own devices" on approved_devices
  for select using (auth.uid() = user_id);

drop policy if exists "insert own devices" on approved_devices;
create policy "insert own devices" on approved_devices
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own devices" on approved_devices;
create policy "update own devices" on approved_devices
  for update using (auth.uid() = user_id);

drop policy if exists "delete own devices" on approved_devices;
create policy "delete own devices" on approved_devices
  for delete using (auth.uid() = user_id);
