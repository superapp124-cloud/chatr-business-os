-- Phase 1: Production Backend (Identity, Auth, Messaging, Calls)

-- 1. Desktop Devices and Trust
CREATE TABLE IF NOT EXISTS public.desktop_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    os_version TEXT,
    app_version TEXT,
    trusted BOOLEAN DEFAULT false,
    last_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Scoped Desktop Sessions
CREATE TABLE IF NOT EXISTS public.desktop_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.desktop_devices(id) ON DELETE CASCADE,
    jwt_token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, revoked, expired
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Session Audit Logs
CREATE TABLE IF NOT EXISTS public.desktop_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.desktop_sessions(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'login', 'logout', 'revoked', 'token_refresh'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Message Acknowledgements (Read receipts, sync status)
CREATE TABLE IF NOT EXISTS public.message_acknowledgements (
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.desktop_devices(id) ON DELETE SET NULL,
    status TEXT NOT NULL, -- 'delivered', 'read', 'played'
    acknowledged_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (message_id, user_id, device_id)
);

-- 5. Offline Queue (For syncing messages when desktop was offline)
CREATE TABLE IF NOT EXISTS public.sync_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.desktop_devices(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'message', 'call', 'presence'
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL,
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE public.desktop_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queues ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own devices" ON public.desktop_devices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own sessions" ON public.desktop_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own audit logs" ON public.desktop_audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage acks" ON public.message_acknowledgements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage sync queue" ON public.sync_queues FOR ALL USING (auth.uid() = user_id);
