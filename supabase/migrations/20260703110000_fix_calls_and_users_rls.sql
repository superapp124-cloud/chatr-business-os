-- =============================================================================
-- Fix: Add missing columns to calls table + fix users RLS for web login
-- =============================================================================

-- 1. Add missing columns to calls table that the frontend expects
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS caller_name TEXT,
  ADD COLUMN IF NOT EXISTS caller_avatar TEXT,
  ADD COLUMN IF NOT EXISTS caller_phone TEXT,
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'voice',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add RLS policies for calls so receivers can see incoming calls
DROP POLICY IF EXISTS "Receivers can view incoming calls" ON public.calls;
CREATE POLICY "Receivers can view incoming calls" ON public.calls
  FOR SELECT USING (receiver_id = auth.uid() OR caller_id = auth.uid());

-- 3. Fix users table RLS - add INSERT policy for auth'd users and service role
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- 4. Make sure service_role can always bypass RLS (this is the default but be explicit)
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.calls TO service_role;

-- 5. Add index for receiver_id to speed up ringing call lookups
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON public.calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
