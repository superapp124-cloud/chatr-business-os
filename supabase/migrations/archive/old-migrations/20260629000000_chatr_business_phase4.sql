-- CHATR Business Platform Phase 4 Migration: Business Operations & Ecosystem

-- 1. Business Workflows
CREATE TABLE public.business_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
    run_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_workflows_profile_id ON public.business_workflows(profile_id);

-- 2. Business Campaigns
CREATE TABLE public.business_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('whatsapp', 'email', 'sms', 'push')),
    audience_segment TEXT NOT NULL,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed')),
    sent_count INTEGER NOT NULL DEFAULT 0,
    open_count INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    scheduled_for TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_campaigns_profile_id ON public.business_campaigns(profile_id);

-- 3. API Keys
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- Storing only the hashed key for security
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_profile_id ON public.api_keys(profile_id);

-- 4. Webhooks
CREATE TABLE public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    secret TEXT NOT NULL, -- Used to sign payloads
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_profile_id ON public.webhooks(profile_id);

-- 5. Business Call Logs (Advanced Routing History)
CREATE TABLE public.business_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    caller_number TEXT NOT NULL,
    receiver_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('missed', 'completed', 'voicemail', 'abandoned')),
    routing_workflow_id UUID REFERENCES public.business_workflows(id) ON DELETE SET NULL,
    recording_url TEXT,
    transcription TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_call_logs_profile_id ON public.business_call_logs(profile_id);

-- Set Up Row Level Security (RLS)

ALTER TABLE public.business_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own workflows" ON public.business_workflows
    FOR ALL USING (auth.uid() = profile_id);

ALTER TABLE public.business_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own campaigns" ON public.business_campaigns
    FOR ALL USING (auth.uid() = profile_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own api keys" ON public.api_keys
    FOR ALL USING (auth.uid() = profile_id);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own webhooks" ON public.webhooks
    FOR ALL USING (auth.uid() = profile_id);

ALTER TABLE public.business_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own call logs" ON public.business_call_logs
    FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert their own call logs" ON public.business_call_logs
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Enable real-time replication for workflows and campaigns
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_campaigns;
