-- Adds a debt_section tag so a debt can be marked as a "360 Debts"
-- (partner) entry, filterable into its own section while still
-- counting in the existing debt totals — same pattern as
-- cost_section for 360 Cell Costs/Wages.
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists debt_section text check (debt_section in ('partner'));
