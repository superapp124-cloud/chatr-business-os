-- Phase 1 (Workspace Pivot): AI Memory Foundations
-- This schema represents the "Chronological Log" of a user's daily activity,
-- replacing the traditional concept of just "chat history".

CREATE TABLE IF NOT EXISTS public.ai_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL, -- 'call', 'message', 'meeting', 'document_share', 'task_created', 'ai_decision'
    
    -- The core content or summary of what happened
    content TEXT NOT NULL,
    
    -- Contextual links to other entities
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    
    -- Extracted Entities by the AI (JSON array of people, projects, keywords)
    entities JSONB DEFAULT '[]'::jsonb,
    
    -- The temporal location of this memory
    happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own AI memory" 
    ON public.ai_memory 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Create an index on happened_at for fast timeline queries
CREATE INDEX IF NOT EXISTS idx_ai_memory_happened_at ON public.ai_memory(user_id, happened_at DESC);
-- Create a GIN index on entities to quickly answer "Show me everything related to Client X"
CREATE INDEX IF NOT EXISTS idx_ai_memory_entities ON public.ai_memory USING GIN(entities);
