CREATE TABLE public.trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT,
    platform TEXT,
    public_key TEXT NOT NULL,
    device_fingerprint TEXT,
    device_trust_level TEXT DEFAULT 'FULL',
    risk_score INT DEFAULT 0,
    organization_id UUID,
    managed BOOLEAN DEFAULT false,
    policy JSONB DEFAULT '{}'::jsonb,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_primary BOOLEAN DEFAULT false
);

CREATE TABLE public.device_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES public.trusted_devices(device_id) ON DELETE CASCADE,
    challenge_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own devices" ON public.trusted_devices FOR ALL USING (auth.uid() = user_id);

-- Ensure edge functions can access this via service role
GRANT ALL PRIVILEGES ON public.trusted_devices TO service_role;
GRANT ALL PRIVILEGES ON public.device_challenges TO service_role;
