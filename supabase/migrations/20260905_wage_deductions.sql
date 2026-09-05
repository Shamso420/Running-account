-- Adds an optional deduction to wage entries (e.g. a cash advance taken
-- out of an employee's salary). The wage entry's amount/usd/lbp columns
-- keep storing the net amount actually paid out (so reports are
-- unaffected); gross_amount, deduction_amount, and deduction_reason are
-- extra columns that record the breakdown for display.
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists gross_amount numeric,
  add column if not exists deduction_amount numeric,
  add column if not exists deduction_reason text;
