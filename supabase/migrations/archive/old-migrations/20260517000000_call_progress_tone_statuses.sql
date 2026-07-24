-- Call Progress Tone Engine support.
-- Adds explicit terminal states used by native GSM-style tone handling.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'calls'
      AND con.contype = 'c'
      AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_status_check
  CHECK (
    status IN (
      'ringing',
      'active',
      'ongoing',
      'ended',
      'missed',
      'declined',
      'rejected',
      'busy',
      'timeout',
      'failed'
    )
  );

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'calls'
      AND con.contype = 'c'
      AND att.attname = 'webrtc_state'
  LOOP
    EXECUTE format('ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_webrtc_state_check
  CHECK (
    webrtc_state IS NULL OR
    webrtc_state IN (
      'signaling',
      'connecting',
      'connected',
      'reconnecting',
      'failed',
      'ended'
    )
  );
