-- Adds optional serial number and IMEI fields to inventory items, for
-- tracking a specific unit (e.g. a phone) rather than just a stock count.
-- Run this once in the Supabase SQL editor for this project.

alter table inventory
  add column if not exists serial_number text,
  add column if not exists imei text;
