-- Migration: Recruiter Workspace (Phase 3.1)

-- 1. Create Requisitions Table
CREATE TABLE IF NOT EXISTS public.requisitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL, -- Full-time, Contract, etc.
    status TEXT NOT NULL DEFAULT 'Open', -- Open, Closed, On Hold
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert requisitions
CREATE POLICY "Enable read access for authenticated users" ON public.requisitions
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON public.requisitions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON public.requisitions
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 2. Create Candidates Table
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    resume_url TEXT,
    status TEXT NOT NULL DEFAULT 'New', -- New, Screened, Interviewing, Offered, Rejected
    rating INTEGER DEFAULT 0,
    applied_for UUID REFERENCES public.requisitions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert candidates
CREATE POLICY "Enable read access for authenticated users" ON public.candidates
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON public.candidates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON public.candidates
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Enable Realtime for these tables
-- (Assuming realtime publication already exists in Supabase projects, we just alter it, but let's be safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE requisitions;
ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
