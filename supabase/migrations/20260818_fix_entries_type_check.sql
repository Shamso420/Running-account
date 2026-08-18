-- Fixes the entries.type check constraint, which was never updated when
-- the "profit" type was renamed to "sale" — meaning no Sale entry has
-- been able to save since. Run this in the Supabase SQL editor.
-- Keeps "profit" in the allowed list so old rows created before the
-- rename remain valid.

alter table entries drop constraint if exists entries_type_check;

alter table entries add constraint entries_type_check
  check (type in ('income', 'expense', 'investment', 'debt', 'sale', 'profit'));
