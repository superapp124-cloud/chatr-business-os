-- Stage 1.5: Live Provider Testbed APIs
-- Instead of using 3rd party APIs during staging verification, we run deterministic
-- "Live Testbed" providers backed by these exact Supabase tables.

-- 1. Testbed: HR Candidates
CREATE TABLE IF NOT EXISTS public.testbed_hr_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sourced',
    resume_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Testbed: Travel Bookings
CREATE TABLE IF NOT EXISTS public.testbed_travel_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    destination TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_approval',
    estimated_cost NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Testbed: Finance Ledgers
CREATE TABLE IF NOT EXISTS public.testbed_finance_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (Strictly locked down to authenticated runtime users)
ALTER TABLE public.testbed_hr_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testbed_travel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testbed_finance_ledgers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read and write HR candidates" ON public.testbed_hr_candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read and write Travel bookings" ON public.testbed_travel_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read and write Finance ledgers" ON public.testbed_finance_ledgers FOR ALL TO authenticated USING (true) WITH CHECK (true);

