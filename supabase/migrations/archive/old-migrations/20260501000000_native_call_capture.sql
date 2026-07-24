-- Native ChatrCalls capture pipeline.
-- Stores carrier call events per user and crowdsources caller names through
-- privacy-preserving hashed-number observations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.native_call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_event_id TEXT NOT NULL,
  call_log_id TEXT,
  phone_number TEXT,
  normalized_number TEXT NOT NULL,
  hashed_number TEXT NOT NULL,
  contact_name TEXT,
  caller_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'allowed', 'blocked', 'completed', 'missed', 'rejected', 'ended')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  trust_score INTEGER NOT NULL DEFAULT 50,
  spam_reports INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe', 'suspicious', 'spam')),
  source TEXT NOT NULL DEFAULT 'android_native',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_event_id)
);

CREATE INDEX IF NOT EXISTS idx_native_call_events_user_started
  ON public.native_call_events(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_native_call_events_hash
  ON public.native_call_events(hashed_number);
CREATE INDEX IF NOT EXISTS idx_native_call_events_status
  ON public.native_call_events(status);

ALTER TABLE public.native_call_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own native call events" ON public.native_call_events;
DROP POLICY IF EXISTS "Users can insert own native call events" ON public.native_call_events;
DROP POLICY IF EXISTS "Users can update own native call events" ON public.native_call_events;
DROP POLICY IF EXISTS "Users can delete own native call events" ON public.native_call_events;

CREATE POLICY "Users can read own native call events"
  ON public.native_call_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own native call events"
  ON public.native_call_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own native call events"
  ON public.native_call_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own native call events"
  ON public.native_call_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.caller_identity_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  hashed_number TEXT NOT NULL,
  observed_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'android_call_log',
  confidence INTEGER NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, hashed_number, source)
);

CREATE INDEX IF NOT EXISTS idx_caller_identity_observations_hash
  ON public.caller_identity_observations(hashed_number);
CREATE INDEX IF NOT EXISTS idx_caller_identity_observations_reporter
  ON public.caller_identity_observations(reporter_id);

ALTER TABLE public.caller_identity_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own caller observations" ON public.caller_identity_observations;
DROP POLICY IF EXISTS "Users can insert own caller observations" ON public.caller_identity_observations;
DROP POLICY IF EXISTS "Users can update own caller observations" ON public.caller_identity_observations;
DROP POLICY IF EXISTS "Users can delete own caller observations" ON public.caller_identity_observations;

CREATE POLICY "Users can read own caller observations"
  ON public.caller_identity_observations FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can insert own caller observations"
  ON public.caller_identity_observations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can update own caller observations"
  ON public.caller_identity_observations FOR UPDATE
  TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can delete own caller observations"
  ON public.caller_identity_observations FOR DELETE
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE OR REPLACE FUNCTION public.refresh_contacts_hash_from_observations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash TEXT;
  v_name TEXT;
  v_frequency INTEGER;
  v_trust_score INTEGER;
BEGIN
  v_hash := COALESCE(NEW.hashed_number, OLD.hashed_number);

  SELECT observed_name, COUNT(*)
  INTO v_name, v_frequency
  FROM public.caller_identity_observations
  WHERE hashed_number = v_hash
    AND observed_name IS NOT NULL
    AND length(trim(observed_name)) > 0
  GROUP BY observed_name
  ORDER BY COUNT(*) DESC, MAX(confidence) DESC
  LIMIT 1;

  IF v_name IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_trust_score := LEAST(95, 50 + (v_frequency * 5));

  INSERT INTO public.contacts_hash (hashed_number, name, frequency, trust_score, updated_at)
  VALUES (v_hash, v_name, v_frequency, v_trust_score, now())
  ON CONFLICT (hashed_number) DO UPDATE SET
    name = EXCLUDED.name,
    frequency = GREATEST(public.contacts_hash.frequency, EXCLUDED.frequency),
    trust_score = GREATEST(public.contacts_hash.trust_score, EXCLUDED.trust_score),
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_contacts_hash_from_observations
  ON public.caller_identity_observations;

CREATE TRIGGER trg_refresh_contacts_hash_from_observations
AFTER INSERT OR UPDATE OR DELETE ON public.caller_identity_observations
FOR EACH ROW EXECUTE FUNCTION public.refresh_contacts_hash_from_observations();
