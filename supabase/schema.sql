-- ============================================================
-- Forest Coffee Logistics — Supabase PostgreSQL Schema
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WAREHOUSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- e.g., 'ANNEX', 'CONTINENTAL', 'GREEN_ROOM'
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  phone TEXT,
  fax TEXT,
  email TEXT,
  contact_person TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- QUOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  origin_warehouse_id UUID REFERENCES public.warehouses(id),
  origin_address TEXT,
  origin_city TEXT,
  origin_state TEXT,
  origin_zip TEXT,
  destination_address TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_state TEXT NOT NULL,
  destination_zip TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  qty_70kg INTEGER NOT NULL DEFAULT 0,
  qty_35kg INTEGER NOT NULL DEFAULT 0,
  qty_24kg INTEGER NOT NULL DEFAULT 0,
  total_pallets INTEGER NOT NULL,
  total_weight DECIMAL(10, 2) NOT NULL,
  liftgate_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  echo_quote_id TEXT,
  cheapest_carrier TEXT,
  cheapest_price DECIMAL(10, 2),
  cheapest_transit_days INTEGER,
  screenshot_url TEXT,
  automation_error TEXT,
  automation_started_at TIMESTAMPTZ,
  automation_completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- QUOTE RESULTS TABLE (top 3 carriers per quote)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  carrier_name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  transit_days INTEGER,
  estimated_delivery_date DATE,
  echo_quote_id TEXT,
  rank INTEGER NOT NULL DEFAULT 1, -- 1 = cheapest
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SCREENSHOTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS quotes_created_by_idx ON public.quotes(created_by);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes(status);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_customer_name_idx ON public.quotes(customer_name);
CREATE INDEX IF NOT EXISTS quote_results_quote_id_idx ON public.quote_results(quote_id);
CREATE INDEX IF NOT EXISTS quote_results_rank_idx ON public.quote_results(quote_id, rank);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- Warehouses: all authenticated users can read
CREATE POLICY "Authenticated users can view warehouses"
  ON public.warehouses FOR SELECT
  TO authenticated USING (true);

-- Quotes: users can only see their own quotes
CREATE POLICY "Users can view their own quotes"
  ON public.quotes FOR SELECT
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can create quotes"
  ON public.quotes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own quotes"
  ON public.quotes FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

-- Service role bypass (for automation)
CREATE POLICY "Service role can do everything on quotes"
  ON public.quotes FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role can do everything on results"
  ON public.quote_results FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role can do everything on screenshots"
  ON public.screenshots FOR ALL
  TO service_role USING (true);

-- Quote results: readable if parent quote is accessible
CREATE POLICY "Users can view results of their quotes"
  ON public.quote_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_results.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

-- Screenshots: readable if parent quote is accessible
CREATE POLICY "Users can view screenshots of their quotes"
  ON public.screenshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = screenshots.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

-- ============================================================
-- SEED WAREHOUSES
-- ============================================================
INSERT INTO public.warehouses (name, code, address, city, state, zip, phone, country) VALUES
  ('ANNEX CONSOLIDATION CENTER', 'ANNEX', '300 Mitchell Ave', 'Alameda', 'CA', '94501', '+1 510-352-8244', 'US'),
  ('CONTINENTAL NJ', 'CONTINENTAL', '200 Middlesex Ave', 'Carteret', 'NJ', '07008', '973-578-2702', 'US'),
  ('GREEN ROOM', 'GREEN_ROOM', '1302 29th Street NW', 'Auburn', 'WA', '98001', '+1 253-735-4470', 'US'),
  ('DUPUY STORAGE HOUSTON', 'DUPUY', '7703 Cannon Street', 'Houston', 'TX', '77021', '832-384-7750', 'US'),
  ('COSTA ORO INTL LLC', 'COSTA_ORO', '440 E 19th Street', 'Tacoma', 'WA', '98421', NULL, 'US'),
  ('GBH DEPOT INC - CANADA', 'GBH_CANADA', '55 Marie-Curie', 'Salaberry-de-Valleyfield', 'QC', 'J6T 0R8', NULL, 'CA')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STORAGE BUCKET SETUP
-- ============================================================
-- Option 1: Run in Supabase SQL editor
-- INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', true)
-- ON CONFLICT (id) DO NOTHING;

-- Option 2: Via Supabase CLI
-- supabase storage create-bucket screenshots --public

-- Option 3: Via Supabase Dashboard
-- Go to Storage > New bucket > name: "screenshots" > Public bucket: ON

-- ============================================================
-- SUPABASE CLI COMMANDS REFERENCE
-- ============================================================
-- Initialize local project:
--   supabase init
--
-- Link to remote project:
--   supabase link --project-ref <your-project-ref>
--
-- Push schema to remote:
--   supabase db push
--
-- Pull remote schema:
--   supabase db pull
--
-- Generate TypeScript types:
--   supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
--
-- Create storage bucket via CLI:
--   supabase storage create-bucket screenshots --public
