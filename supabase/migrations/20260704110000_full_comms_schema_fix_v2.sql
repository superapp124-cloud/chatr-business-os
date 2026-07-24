-- ==============================================================================
-- CHATR FULL COMMUNICATION SCHEMA FIX (v2 - fixed ordering)
-- ==============================================================================

-- ── 1. FIX MESSAGES TABLE ────────────────────────────────────────────────────
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Grant access
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Participants can update messages'
    ) THEN
        CREATE POLICY "Participants can update messages" ON public.messages FOR UPDATE
            USING (exists (
                SELECT 1 FROM public.conversation_participants
                WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
            ));
    END IF;
END
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ── 2. FIX CALLS TABLE ───────────────────────────────────────────────────────
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_type text DEFAULT 'audio';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_name text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_avatar text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_phone text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS receiver_name text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS receiver_avatar text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS receiver_phone text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone;

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calls' AND policyname = 'Callers can insert calls'
    ) THEN
        CREATE POLICY "Callers can insert calls" ON public.calls FOR INSERT WITH CHECK (auth.uid() = caller_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calls' AND policyname = 'Call participants can update calls'
    ) THEN
        CREATE POLICY "Call participants can update calls" ON public.calls FOR UPDATE
            USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calls' AND policyname = 'Receivers can view incoming calls'
    ) THEN
        CREATE POLICY "Receivers can view incoming calls" ON public.calls FOR SELECT
            USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
    END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- ── 3. CREATE SESSION_ROOM_PARTICIPANTS FIRST (to satisfy FK reference) ──────
CREATE TABLE IF NOT EXISTS public.session_room_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id uuid NOT NULL, -- FK added after session_rooms is created below
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.session_room_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_room_participants TO authenticated;

-- ── 4. CREATE SESSION_ROOMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_rooms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_goal text DEFAULT 'quick',
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.session_rooms ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_rooms TO authenticated;

-- ── 5. ADD FK FROM session_room_participants to session_rooms ─────────────────
ALTER TABLE public.session_room_participants
    ADD CONSTRAINT session_room_participants_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES public.session_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.session_room_participants 
    ADD CONSTRAINT session_room_participants_room_user_key UNIQUE(room_id, user_id);

-- ── 6. POLICIES NOW THAT BOTH TABLES EXIST ───────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rooms' AND policyname = 'Host can manage rooms'
    ) THEN
        CREATE POLICY "Host can manage rooms" ON public.session_rooms FOR ALL
            USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rooms' AND policyname = 'Participants can view rooms'
    ) THEN
        CREATE POLICY "Participants can view rooms" ON public.session_rooms FOR SELECT
            USING (
                auth.uid() = host_id OR
                EXISTS (
                    SELECT 1 FROM public.session_room_participants srp
                    WHERE srp.room_id = session_rooms.id AND srp.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_room_participants' AND policyname = 'Users can join rooms'
    ) THEN
        CREATE POLICY "Users can join rooms" ON public.session_room_participants FOR INSERT
            WITH CHECK (
                auth.uid() = user_id OR
                EXISTS (SELECT 1 FROM public.session_rooms WHERE id = room_id AND host_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_room_participants' AND policyname = 'Room participants can view each other'
    ) THEN
        CREATE POLICY "Room participants can view each other" ON public.session_room_participants FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.session_room_participants srp
                    WHERE srp.room_id = session_room_participants.room_id AND srp.user_id = auth.uid()
                )
            );
    END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_room_participants;

-- ── 7. CONVERSATIONS INSERT GRANT ─────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Authenticated can create conversations'
    ) THEN
        CREATE POLICY "Authenticated can create conversations" ON public.conversations FOR INSERT
            WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END
$$;

-- ── 8. AI MEMORY ACCESS ───────────────────────────────────────────────────────
GRANT SELECT, INSERT ON public.ai_memory TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_memory' AND policyname = 'Users can read org AI memory'
    ) THEN
        CREATE POLICY "Users can read org AI memory" ON public.ai_memory FOR SELECT
            USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_memory' AND policyname = 'Users can insert AI memory'
    ) THEN
        CREATE POLICY "Users can insert AI memory" ON public.ai_memory FOR INSERT
            WITH CHECK (user_id = auth.uid());
    END IF;
END
$$;
