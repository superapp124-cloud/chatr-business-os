-- CHATR Orchestration Layer: durable event bus + mobile action queue

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  correlation_id UUID,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_events_user_created
  ON public.communication_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_events_type_created
  ON public.communication_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_events_candidate
  ON public.communication_events(candidate_id, created_at DESC)
  WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_events_correlation
  ON public.communication_events(correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own communication events"
  ON public.communication_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own communication events"
  ON public.communication_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own communication events"
  ON public.communication_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mobile_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('place_call', 'send_message', 'update_workspace')),
  target_device_id UUID REFERENCES public.desktop_devices(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  correlation_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_action_queue_user_status
  ON public.mobile_action_queue(user_id, status, scheduled_for ASC);
CREATE INDEX IF NOT EXISTS idx_mobile_action_queue_candidate
  ON public.mobile_action_queue(candidate_id, created_at DESC)
  WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mobile_action_queue_correlation
  ON public.mobile_action_queue(correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE public.mobile_action_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mobile actions"
  ON public.mobile_action_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mobile actions"
  ON public.mobile_action_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mobile actions"
  ON public.mobile_action_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_mobile_action_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_mobile_action_queue_updated_at ON public.mobile_action_queue;
CREATE TRIGGER update_mobile_action_queue_updated_at
BEFORE UPDATE ON public.mobile_action_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_mobile_action_queue_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_events;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_action_queue;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;
