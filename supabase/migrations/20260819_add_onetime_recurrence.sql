-- Adds "once" (one-time cost) as a valid recurrence value, alongside
-- the existing weekly/monthly options for 360 Cell Costs and Wages.
-- Run this once in the Supabase SQL editor for this project.

alter table entries drop constraint if exists entries_recurrence_check;

alter table entries add constraint entries_recurrence_check
  check (recurrence in ('once', 'weekly', 'monthly'));
