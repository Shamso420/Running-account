-- One-time data migration: reassigns ownership of the historical "360
-- Cell" ledger data (entries, customers, goals, inventory, sale
-- payments) from info360cell@gmail.com to hassanplaystation74@gmail.com,
-- so that data shows up when signed in as the latter account.
--
-- This changes which account owns existing rows in a live database.
-- There is no built-in "undo" short of running the reverse update by
-- hand, so this is effectively irreversible — review before running.
-- Wrapped in a transaction: if anything fails (e.g. a uniqueness
-- conflict on customers), nothing is partially applied.
--
-- profiles is intentionally NOT touched here — a profile's id IS the
-- Supabase auth user's id, so reassigning it would break login for
-- one of the two accounts rather than merge data.
-- approved_devices is also NOT touched — device approvals are
-- per-login-credential security metadata, not business data.
--
-- Run this once in the Supabase SQL editor for this project.

begin;

do $$
declare
  from_id uuid;
  to_id uuid;
begin
  select id into from_id from auth.users where email = 'info360cell@gmail.com';
  select id into to_id from auth.users where email = 'hassanplaystation74@gmail.com';

  if from_id is null then
    raise exception 'No auth user found for info360cell@gmail.com';
  end if;
  if to_id is null then
    raise exception 'No auth user found for hassanplaystation74@gmail.com';
  end if;

  update entries set user_id = to_id where user_id = from_id;
  update customers set user_id = to_id where user_id = from_id;
  update goals set user_id = to_id where user_id = from_id;
  update inventory set user_id = to_id where user_id = from_id;
  update sale_payments set user_id = to_id where user_id = from_id;
end $$;

commit;
