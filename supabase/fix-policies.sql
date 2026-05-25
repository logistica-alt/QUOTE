-- ============================================================
-- Fix: Drop existing policies before recreating them
-- Run this if you get "policy already exists" errors
-- ============================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can view warehouses"   ON public.warehouses;
DROP POLICY IF EXISTS "Users can view their own quotes"           ON public.quotes;
DROP POLICY IF EXISTS "Users can create quotes"                   ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes"         ON public.quotes;
DROP POLICY IF EXISTS "Service role can do everything on quotes"  ON public.quotes;
DROP POLICY IF EXISTS "Service role can do everything on results" ON public.quote_results;
DROP POLICY IF EXISTS "Service role can do everything on screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can view results of their quotes"    ON public.quote_results;
DROP POLICY IF EXISTS "Users can view screenshots of their quotes" ON public.screenshots;

-- Recreate policies
CREATE POLICY "Authenticated users can view warehouses"
  ON public.warehouses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can view their own quotes"
  ON public.quotes FOR SELECT
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can create quotes"
  ON public.quotes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own quotes"
  ON public.quotes FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Service role can do everything on quotes"
  ON public.quotes FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role can do everything on results"
  ON public.quote_results FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role can do everything on screenshots"
  ON public.screenshots FOR ALL
  TO service_role USING (true);

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

-- Re-insert warehouses (safe — uses ON CONFLICT DO NOTHING)
INSERT INTO public.warehouses (name, code, address, city, state, zip, phone, country) VALUES
  ('ANNEX CONSOLIDATION CENTER', 'ANNEX',       '300 Mitchell Ave',       'Alameda',                    'CA', '94501',   '+1 510-352-8244', 'US'),
  ('CONTINENTAL NJ',             'CONTINENTAL', '200 Middlesex Ave',      'Carteret',                   'NJ', '07008',   '973-578-2702',    'US'),
  ('GREEN ROOM',                 'GREEN_ROOM',  '1302 29th Street NW',    'Auburn',                     'WA', '98001',   '+1 253-735-4470', 'US'),
  ('DUPUY STORAGE HOUSTON',      'DUPUY',       '7703 Cannon Street',     'Houston',                    'TX', '77021',   '832-384-7750',    'US'),
  ('COSTA ORO INTL LLC',         'COSTA_ORO',   '440 E 19th Street',      'Tacoma',                     'WA', '98421',   NULL,              'US'),
  ('GBH DEPOT INC - CANADA',     'GBH_CANADA',  '55 Marie-Curie',         'Salaberry-de-Valleyfield',   'QC', 'J6T 0R8', NULL,              'CA')
ON CONFLICT (code) DO NOTHING;

SELECT 'Done! Policies and warehouses are ready.' AS status;
