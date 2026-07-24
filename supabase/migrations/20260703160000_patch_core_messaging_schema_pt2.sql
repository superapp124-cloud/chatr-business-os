-- ==============================================================================
-- PHASE 1 - PART 2: CORE MESSAGING SCHEMA PATCH
-- Fixing RLS on conversation_participants and conversations, and adding presence_status
-- ==============================================================================

-- 1. FIX PROFILES MISSING COLUMNS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'offline';

-- Drop and recreate the view to ensure it captures all new columns (including presence_status)
DROP VIEW IF EXISTS public.profiles;
CREATE VIEW public.profiles WITH (security_invoker = true) AS SELECT * FROM public.users;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;


-- 2. FIX CONVERSATIONS AND PARTICIPANTS RLS
DO $$
BEGIN
    -- Conversations Policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Participants can view conversations'
    ) THEN
        CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT 
        USING (exists (select 1 from public.conversation_participants where conversation_id = id and user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Participants can update conversations'
    ) THEN
        CREATE POLICY "Participants can update conversations" ON public.conversations FOR UPDATE
        USING (exists (select 1 from public.conversation_participants where conversation_id = id and user_id = auth.uid()));
    END IF;

    -- Conversation Participants Policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND policyname = 'Participants can view other participants'
    ) THEN
        CREATE POLICY "Participants can view other participants" ON public.conversation_participants FOR SELECT 
        USING (exists (select 1 from public.conversation_participants p where p.conversation_id = conversation_id and p.user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND policyname = 'Users can view their own participations'
    ) THEN
        CREATE POLICY "Users can view their own participations" ON public.conversation_participants FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND policyname = 'Users can insert their own participation'
    ) THEN
        CREATE POLICY "Users can insert their own participation" ON public.conversation_participants FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND policyname = 'Participants can update their role'
    ) THEN
        CREATE POLICY "Participants can update their role" ON public.conversation_participants FOR UPDATE
        USING (auth.uid() = user_id);
    END IF;

END
$$;

-- Explicitly ensure RLS is enabled and GRANTs are set for PostgREST
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
