-- Adds IMEI and serial number fields, used only on Investment entries,
-- so a bought phone/device can be tracked and shown on its invoice.
-- Run this once in the Supabase SQL editor for this project.

alter table entries
  add column if not exists imei text,
  add column if not exists serial_number text;
