-- Adds customer type, and the fields needed for the new "Sale" entry type
-- (product sold, cost, and partial-payment collection tracking).
-- Run this once in the Supabase SQL editor for this project.

alter table customers
  add column if not exists type text not null default 'customer'
    check (type in ('merchant', 'retail', 'customer'));

alter table entries
  add column if not exists product text,
  add column if not exists cost_raw numeric,
  add column if not exists cost_usd numeric,
  add column if not exists cost_lbp numeric,
  add column if not exists received_usd numeric not null default 0;
