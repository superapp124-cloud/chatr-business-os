-- Migration: Core Foundation v1 - Part 4
-- Description: Generic Background Job Infrastructure
-- Includes: background_jobs table for processing off-thread tasks (summaries, thumbnails, webhooks, etc.)

CREATE TABLE IF NOT EXISTS public.background_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type text NOT NULL, -- e.g., 'conversation_summary', 'thumbnail_generation', 'virus_scan'
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    run_at timestamptz DEFAULT now(),
    locked_at timestamptz,
    locked_by text,
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for fetching the next available jobs efficiently
CREATE INDEX IF NOT EXISTS idx_background_jobs_queue 
ON public.background_jobs(run_at, status) 
WHERE status = 'pending';

-- RLS: Only the service role (backend worker) can read/update these jobs. 
-- Authenticated users shouldn't have direct access to the queue.
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
-- No policies defined means default DENY ALL for anon/authenticated roles.
