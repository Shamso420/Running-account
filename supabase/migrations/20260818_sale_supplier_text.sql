-- Adds a "bought from" (supplier) field to Sale entries, alongside the
-- existing customer field which now represents "sold to".
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists supplier_text text;
