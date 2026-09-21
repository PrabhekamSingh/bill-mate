-- Supabase PostgreSQL Schema for Bill Mate Application
-- Run this SQL in your Supabase Project -> SQL Editor to create tables & policies.

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  opening_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Items Table (Customer-specific items)
CREATE TABLE IF NOT EXISTS public.items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'pcs',
  rate NUMERIC DEFAULT 0,
  gst_rate NUMERIC DEFAULT 0,
  category TEXT DEFAULT '',
  hsn_code TEXT DEFAULT '',
  stock_quantity NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 5,
  location TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Catalog Items Table (Global Parts Catalog)
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  unit TEXT DEFAULT 'pcs',
  rate NUMERIC DEFAULT 0,
  gst_rate NUMERIC DEFAULT 18,
  hsn_code TEXT DEFAULT '',
  description TEXT DEFAULT '',
  stock_quantity NUMERIC DEFAULT 10,
  min_stock NUMERIC DEFAULT 5,
  location TEXT DEFAULT '',
  active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL,
  subtotal NUMERIC DEFAULT 0,
  gst_total NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  carry_forward NUMERIC DEFAULT 0,
  paid NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bill Items Table
CREATE TABLE IF NOT EXISTS public.bill_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  bill_id BIGINT NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  item_id BIGINT,
  catalog_item_id BIGINT,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  rate NUMERIC DEFAULT 0,
  gst_rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  bill_id BIGINT REFERENCES public.bills(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  mode TEXT DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) or enable public access for anon key usage
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access for local app sync
CREATE POLICY "Allow public read/write access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access to items" ON public.items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access to catalog_items" ON public.catalog_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access to bill_items" ON public.bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
