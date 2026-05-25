-- ============================================================
-- Forest Coffee Logistics — Customers Table Migration
-- ============================================================
-- Run this AFTER the main schema.sql in the Supabase SQL Editor

-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name     TEXT    NOT NULL,
  full_address     TEXT,                        -- raw address string from Google Sheets
  street           TEXT,                        -- parsed street address
  city             TEXT,                        -- parsed city
  state            TEXT,                        -- parsed state / province
  zip              TEXT,                        -- parsed zip / postal code
  country          TEXT    NOT NULL DEFAULT 'US', -- US | CA | EU | UK | AU
  contact_name     TEXT,
  phone            TEXT,
  preferred_carrier TEXT,                       -- from notes column in Sheets
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sheets_row       INTEGER,                     -- row number in Google Sheets (for debugging)
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_name)
);

-- Updated-at trigger
CREATE OR REPLACE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS customers_company_name_idx ON public.customers USING gin(to_tsvector('english', company_name));
CREATE INDEX IF NOT EXISTS customers_country_idx     ON public.customers(country);
CREATE INDEX IF NOT EXISTS customers_is_active_idx   ON public.customers(is_active);
CREATE INDEX IF NOT EXISTS customers_city_state_idx  ON public.customers(city, state);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can search and read customers
CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  TO authenticated USING (true);

-- Only service role can insert/update/delete (sync process)
CREATE POLICY "Service role manages customers"
  ON public.customers FOR ALL
  TO service_role USING (true);
