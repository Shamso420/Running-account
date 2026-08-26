-- Adds a per-unit cost to inventory products, so stock value can be
-- tracked alongside quantity.
-- Run this once in the Supabase SQL editor for this project.

alter table inventory
  add column if not exists unit_cost numeric;
