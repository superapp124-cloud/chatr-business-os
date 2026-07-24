-- Migration to support Desktop Call UI Features
-- Adds security controls to session_rooms and creates tables for Polls & Q&A

-- 1. Add security columns to session_rooms
ALTER TABLE public.session_rooms 
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS chat_disabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS waiting_room_enabled boolean DEFAULT false;

-- 2. Create meeting_polls table
CREATE TABLE IF NOT EXISTS public.meeting_polls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id uuid REFERENCES public.session_rooms(id) ON DELETE CASCADE NOT NULL,
    created_by uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    question text NOT NULL,
    options jsonb NOT NULL, -- Array of strings: ["Option A", "Option B"]
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.meeting_polls ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_polls TO authenticated;

-- Policies for meeting_polls
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_polls' AND policyname = 'Participants can view polls') THEN
        CREATE POLICY "Participants can view polls" ON public.meeting_polls FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM public.session_room_participants srp 
                WHERE srp.room_id = meeting_polls.room_id AND srp.user_id = auth.uid()
            ) OR EXISTS (
                SELECT 1 FROM public.session_rooms sr 
                WHERE sr.id = meeting_polls.room_id AND sr.host_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_polls' AND policyname = 'Host can manage polls') THEN
        CREATE POLICY "Host can manage polls" ON public.meeting_polls FOR ALL
            USING (EXISTS (
                SELECT 1 FROM public.session_rooms sr 
                WHERE sr.id = meeting_polls.room_id AND sr.host_id = auth.uid()
            )) WITH CHECK (EXISTS (
                SELECT 1 FROM public.session_rooms sr 
                WHERE sr.id = meeting_polls.room_id AND sr.host_id = auth.uid()
            ));
    END IF;
END $$;


-- 3. Create meeting_poll_votes table
CREATE TABLE IF NOT EXISTS public.meeting_poll_votes (
    poll_id uuid REFERENCES public.meeting_polls(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.meeting_poll_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_poll_votes TO authenticated;

-- Policies for meeting_poll_votes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_poll_votes' AND policyname = 'Participants can view votes') THEN
        CREATE POLICY "Participants can view votes" ON public.meeting_poll_votes FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM public.meeting_polls mp 
                JOIN public.session_room_participants srp ON mp.room_id = srp.room_id
                WHERE mp.id = meeting_poll_votes.poll_id AND srp.user_id = auth.uid()
            ) OR EXISTS (
                SELECT 1 FROM public.meeting_polls mp
                JOIN public.session_rooms sr ON mp.room_id = sr.id
                WHERE mp.id = meeting_poll_votes.poll_id AND sr.host_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_poll_votes' AND policyname = 'Participants can insert votes') THEN
        CREATE POLICY "Participants can insert votes" ON public.meeting_poll_votes FOR INSERT
            WITH CHECK (auth.uid() = user_id AND EXISTS (
                SELECT 1 FROM public.meeting_polls mp 
                JOIN public.session_room_participants srp ON mp.room_id = srp.room_id
                WHERE mp.id = poll_id AND srp.user_id = auth.uid()
            ) OR EXISTS (
                SELECT 1 FROM public.meeting_polls mp
                JOIN public.session_rooms sr ON mp.room_id = sr.id
                WHERE mp.id = poll_id AND sr.host_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_poll_votes' AND policyname = 'Users can update their own votes') THEN
        CREATE POLICY "Users can update their own votes" ON public.meeting_poll_votes FOR UPDATE
            USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Enable Realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_poll_votes;
