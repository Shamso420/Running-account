-- Adds fields for tracking recurring business costs and wages as
-- regular expense entries, so they show up in existing expense totals
-- while also being filterable into their own dedicated sections.
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists recurrence text check (recurrence in ('weekly', 'monthly')),
  add column if not exists cost_section text check (cost_section in ('cost', 'wage'));
