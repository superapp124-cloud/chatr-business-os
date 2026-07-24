-- Migration: Phase 1 — Missing Tables, RLS Hardening, & Agent Memory
-- Date: 2026-07-09
-- Fixes: calendar_events RLS, email_queue, agent_sessions, workflow_runs, profiles RLS

-- ═══════════════════════════════════════════════════════════
-- 1. CALENDAR EVENTS — Add RLS (table already exists from prior migration)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can see their own events
DROP POLICY IF EXISTS "Users can manage own calendar events" ON public.calendar_events;
CREATE POLICY "Users can manage own calendar events"
  ON public.calendar_events
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (created_by = auth.uid());

-- Add created_by column if missing
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS is_all_day boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON public.calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON public.calendar_events(start_at);

-- ═══════════════════════════════════════════════════════════
-- 2. EMAIL QUEUE — Required by core.email node executor
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  to_address text NOT NULL,
  from_address text,
  subject text NOT NULL,
  body text NOT NULL,
  html_body text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  send_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  workflow_run_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queued emails"
  ON public.email_queue FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert emails"
  ON public.email_queue FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_send_at ON public.email_queue(send_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_by ON public.email_queue(created_by);

-- ═══════════════════════════════════════════════════════════
-- 3. AGENT SESSIONS — Persistent AI conversation memory
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id text NOT NULL,
  session_name text,
  messages jsonb DEFAULT '[]'::jsonb,
  summary text,
  context_tokens integer DEFAULT 0,
  total_messages integer DEFAULT 0,
  model_used text,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agent sessions"
  ON public.agent_sessions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON public.agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_active ON public.agent_sessions(last_active_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 4. WORKFLOW RUNS — Execution history for workflows
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid,
  workflow_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type text DEFAULT 'manual',
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb DEFAULT '{}'::jsonb,
  node_execution_log jsonb DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workflow runs"
  ON public.workflow_runs FOR SELECT
  USING (triggered_by = auth.uid());

CREATE POLICY "Users can insert workflow runs"
  ON public.workflow_runs FOR INSERT
  WITH CHECK (triggered_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_triggered_by ON public.workflow_runs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON public.workflow_runs(started_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 5. BUSINESS ANALYTICS — Aggregated metrics table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_analytics_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  period text NOT NULL DEFAULT '7d' CHECK (period IN ('7d', '30d', '90d')),
  total_conversations integer DEFAULT 0,
  open_conversations integer DEFAULT 0,
  resolved_conversations integer DEFAULT 0,
  new_leads integer DEFAULT 0,
  converted_leads integer DEFAULT 0,
  total_revenue numeric(12,2) DEFAULT 0,
  avg_response_time_seconds integer DEFAULT 0,
  team_members_active integer DEFAULT 0,
  broadcasts_sent integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view analytics"
  ON public.business_analytics_snapshots FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.business_profiles WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_biz_analytics_business_id ON public.business_analytics_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_biz_analytics_date ON public.business_analytics_snapshots(snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════
-- 6. BUSINESS BROADCASTS — Real broadcast persistence
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL,
  name text NOT NULL,
  message text NOT NULL,
  recipient_filter jsonb DEFAULT '{}'::jsonb,
  recipient_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  read_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage broadcasts"
  ON public.business_broadcasts FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.business_profiles WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_biz_broadcasts_business_id ON public.business_broadcasts(business_id);
CREATE INDEX IF NOT EXISTS idx_biz_broadcasts_status ON public.business_broadcasts(status);

-- ═══════════════════════════════════════════════════════════
-- 7. BUSINESS GROUPS — Customer community groups
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  member_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage groups"
  ON public.business_groups FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.business_profiles WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 8. AI ROLES CONFIG — Persist business AI role configurations
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_ai_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL,
  name text NOT NULL,
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'training', 'paused', 'draft')),
  knowledge_sources jsonb DEFAULT '[]'::jsonb,
  tools jsonb DEFAULT '[]'::jsonb,
  escalation_rule text,
  confidence_threshold integer DEFAULT 80,
  allowed_actions jsonb DEFAULT '[]'::jsonb,
  system_prompt text,
  model text DEFAULT 'llama3.2',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_ai_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage AI roles"
  ON public.business_ai_roles FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.business_profiles WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 9. PROFILES RLS HARDENING
-- Replace global read with relationship-scoped read
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Users can always see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Users can see profiles of people they share conversations with
DROP POLICY IF EXISTS "Users can view conversation member profiles" ON public.profiles;
CREATE POLICY "Users can view conversation member profiles"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT cp_other.user_id
      FROM public.conversation_participants cp_other
      WHERE cp_other.conversation_id IN (
        SELECT cp_self.conversation_id
        FROM public.conversation_participants cp_self
        WHERE cp_self.user_id = auth.uid()
      )
    )
  );

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
