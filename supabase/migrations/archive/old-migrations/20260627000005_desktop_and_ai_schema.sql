-- Phase 1: Desktop Connect Pairing Sessions
CREATE TABLE IF NOT EXISTS public.desktop_pairing_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pairing_id UUID NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paired, revoked
    desktop_pubkey TEXT NOT NULL,
    device_name TEXT,
    device_fingerprint TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ
);

ALTER TABLE public.desktop_pairing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their desktop sessions"
    ON public.desktop_pairing_sessions
    FOR ALL
    USING (auth.uid() = user_id);

-- Phase 5: AI Learning & Personalization Engine (Telemetry Store)
CREATE TABLE IF NOT EXISTS public.ai_user_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_context JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_user_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only write their own telemetry"
    ON public.ai_user_telemetry
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
