CREATE TABLE IF NOT EXISTS public.ai_call_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    summary TEXT NOT NULL,
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    calendar_events JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying on the Dashboard
CREATE INDEX IF NOT EXISTS idx_ai_call_summaries_user_generated 
    ON public.ai_call_summaries(user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_call_summaries_phone 
    ON public.ai_call_summaries(phone_number);

-- Enable RLS
ALTER TABLE public.ai_call_summaries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own AI call summaries"
    ON public.ai_call_summaries FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI call summaries"
    ON public.ai_call_summaries FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI call summaries"
    ON public.ai_call_summaries FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI call summaries"
    ON public.ai_call_summaries FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
