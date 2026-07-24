-- Migration: Core Foundation v1 - Part 2
-- Description: Indexes, Foreign Keys, and Normalized Tracking (reactions, receipts)
-- Includes: message_reactions, message_receipts, and search indexes.

-- 1. Database Integrity (Indexes)
-- Adding organization_id to messages for future search and multi-tenant partitioning
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_organization_id ON public.messages(organization_id);
-- (Other indexes like conversation_id, sender_id, created_at, type were added in the previous migration)

-- 2. Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view message reactions"
    ON public.message_reactions FOR SELECT
    USING (message_id IN (
        SELECT id FROM public.messages WHERE conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "Participants can insert message reactions"
    ON public.message_reactions FOR INSERT
    WITH CHECK (message_id IN (
        SELECT id FROM public.messages WHERE conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    ));

-- 3. Message Receipts (Modern Read/Delivery tracking)
CREATE TABLE IF NOT EXISTS public.message_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    delivered_at timestamptz,
    read_at timestamptz,
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id ON public.message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_user_id ON public.message_receipts(user_id);

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view message receipts"
    ON public.message_receipts FOR SELECT
    USING (message_id IN (
        SELECT id FROM public.messages WHERE conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "Participants can insert/update their own receipts"
    ON public.message_receipts FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
