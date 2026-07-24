-- ==============================================================================
-- CHATR AI DIALER v2 SCHEMA (Truecaller+++)
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Contacts Hash (Crowdsourced Caller ID)
CREATE TABLE IF NOT EXISTS public.contacts_hash (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hashed_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    trust_score INTEGER DEFAULT 50, -- 0 (Spam) to 100 (Trusted)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup when a call rings
CREATE INDEX IF NOT EXISTS idx_contacts_hash_number ON public.contacts_hash(hashed_number);

-- 2. Spam Reports
CREATE TABLE IF NOT EXISTS public.spam_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    number TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('spam', 'fraud', 'business_promotion', 'other')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spam_reports_number ON public.spam_reports(number);

-- 3. Call Insights (Post-Call AI Data)
CREATE TABLE IF NOT EXISTS public.call_insights (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    suggested_action TEXT, -- e.g., "Call back later", "Business lead"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_insights_user ON public.call_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_call_insights_number ON public.call_insights(number);

-- Security Policies
ALTER TABLE public.contacts_hash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_insights ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the contacts hash (so the app can lookup numbers)
CREATE POLICY "Allow public read of contacts_hash" ON public.contacts_hash FOR SELECT USING (true);

-- Allow authenticated users to report spam
CREATE POLICY "Allow auth insert to spam_reports" ON public.spam_reports FOR INSERT TO authenticated WITH CHECK (true);

-- Allow users to manage their own call insights
CREATE POLICY "Users can manage their own call insights" ON public.call_insights
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Optional: Create a function to look up a number and its spam count instantly
CREATE OR REPLACE FUNCTION lookup_caller_id(p_hashed_number TEXT, p_raw_number TEXT)
RETURNS JSON AS $$
DECLARE
    contact_record RECORD;
    spam_count INTEGER;
    result JSON;
BEGIN
    -- Get the name from hash
    SELECT name, trust_score INTO contact_record FROM public.contacts_hash WHERE hashed_number = p_hashed_number LIMIT 1;
    
    -- Count spam reports
    SELECT COUNT(*) INTO spam_count FROM public.spam_reports WHERE number = p_raw_number;
    
    result := json_build_object(
        'name', COALESCE(contact_record.name, 'Unknown Caller'),
        'trust_score', COALESCE(contact_record.trust_score, 50),
        'spam_reports', spam_count
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
