CREATE TABLE IF NOT EXISTS public.identity_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_uid TEXT NOT NULL,
    provider_phone TEXT,
    provider_email TEXT,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_uid)
);

-- Enable RLS
ALTER TABLE public.identity_providers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own identity providers"
    ON public.identity_providers
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage identity providers"
    ON public.identity_providers
    USING (true)
    WITH CHECK (true);
