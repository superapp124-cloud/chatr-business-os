-- Phase 3: Agent Marketplace Schema

-- Agents Table (The listing in the marketplace)
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID REFERENCES public.profiles(id),
    version TEXT DEFAULT '1.0.0',
    category TEXT NOT NULL,
    price_model TEXT DEFAULT 'free', -- free, premium, pay-per-use
    capabilities JSONB DEFAULT '[]'::jsonb,
    is_verified BOOLEAN DEFAULT false,
    rating DECIMAL(3,2) DEFAULT 0.0,
    install_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agent Installations (Which user has which agent installed)
CREATE TABLE IF NOT EXISTS public.ai_agent_installations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, agent_id)
);

-- Agent Reviews
CREATE TABLE IF NOT EXISTS public.ai_agent_reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_reviews ENABLE ROW LEVEL SECURITY;

-- Agents are public to read
CREATE POLICY "Agents are viewable by everyone" ON public.ai_agents
    FOR SELECT USING (true);

-- Users can manage their own installations
CREATE POLICY "Users can view their own agent installations" ON public.ai_agent_installations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can install agents" ON public.ai_agent_installations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent settings" ON public.ai_agent_installations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can uninstall agents" ON public.ai_agent_installations
    FOR DELETE USING (auth.uid() = user_id);

-- Reviews
CREATE POLICY "Reviews are viewable by everyone" ON public.ai_agent_reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can write reviews" ON public.ai_agent_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed Initial Marketplace Data
INSERT INTO public.ai_agents (name, description, creator_id, category, price_model, install_count, rating)
VALUES 
('RecruitmentOS Sourcing Agent', 'Automates candidate sourcing from LinkedIn and GitHub matching your JD parameters.', NULL, 'HR & Recruitment', 'free', 12400, 4.9),
('Legal Contract Reviewer', 'Reads NDAs and MSA contracts, highlighting liabilities and non-standard clauses.', NULL, 'Legal', 'premium', 3200, 4.7),
('Senior Code Reviewer', 'Acts as a strict senior engineer. Reviews PRs for security, performance, and best practices.', NULL, 'Engineering', 'free', 45000, 4.8),
('Medical Triage Assistant', 'HIPAA-compliant agent that conducts preliminary patient symptom screening.', NULL, 'Healthcare', 'pay-per-use', 890, 4.6),
('Finance & Accounting Agent', 'Automates GST reminders, invoice collection, and tax filing workflows.', NULL, 'Finance', 'free', 8400, 4.8),
('Sales & CRM Agent', 'Manages leads, auto-generates quotes, and handles follow-ups and renewals.', NULL, 'Sales', 'premium', 15200, 4.9),
('Customer Success Agent', 'Monitors product usage and proactively reaches out for onboarding and retention.', NULL, 'Sales', 'free', 6200, 4.7),
('Marketing Campaign Agent', 'Drafts copy, schedules posts, and optimizes ad budgets based on analytics.', NULL, 'Engineering', 'pay-per-use', 4100, 4.5),
('Compliance & Audit Agent', 'Constantly monitors internal workflows to ensure GDPR and HIPAA compliance.', NULL, 'Legal', 'premium', 1200, 4.9),
('Real Estate Workflow Agent', 'Automates property listings, tenant screening, and lease agreement generation.', NULL, 'Finance', 'free', 2900, 4.6)
ON CONFLICT DO NOTHING;
