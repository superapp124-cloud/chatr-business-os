-- Migration: Core Foundation v1 Schema Additions
-- Description: Non-destructive additions for the AI Conversation API foundation.
-- Includes: ai_settings, conversation_summaries, expanded ai_memory, ai_tools.

-- 1. AI Settings
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    default_model text NOT NULL DEFAULT 'llama3',
    temperature numeric NOT NULL DEFAULT 0.7,
    max_tokens integer NOT NULL DEFAULT 2048,
    context_limit integer NOT NULL DEFAULT 8192,
    provider text NOT NULL DEFAULT 'ollama',
    allow_tools boolean NOT NULL DEFAULT true,
    allow_memory boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for ai_settings
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view ai_settings"
    ON public.ai_settings FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- 2. Conversation Summaries
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    summary text NOT NULL,
    generated_at timestamptz DEFAULT now(),
    message_range int4range,
    model text NOT NULL
);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view conversation_summaries"
    ON public.conversation_summaries FOR SELECT
    USING (conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ));

-- 3. AI Tools
CREATE TABLE IF NOT EXISTS public.ai_tools (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    tool_name text NOT NULL,
    request jsonb NOT NULL,
    response jsonb,
    status text NOT NULL DEFAULT 'pending',
    latency_ms integer,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    error text
);

ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view ai_tools"
    ON public.ai_tools FOR SELECT
    USING (conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ));

-- 4. Expand AI Memory
-- Existing ai_memory table has: id, user_id, organization_id, fact, confidence_score
-- We need to add: memory_type, scope, content, importance, last_accessed, embedding_id, source_message_id, expires_at, created_at, updated_at
ALTER TABLE public.ai_memory 
    ADD COLUMN IF NOT EXISTS memory_type text,
    ADD COLUMN IF NOT EXISTS scope text DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS content text,
    ADD COLUMN IF NOT EXISTS importance integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_accessed timestamptz,
    ADD COLUMN IF NOT EXISTS embedding_id text,
    ADD COLUMN IF NOT EXISTS source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5. Expand Messages for Versioning
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS edited_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS thread_id uuid;

-- 6. Indexes for Performance (Step 2 Preview)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(type);
