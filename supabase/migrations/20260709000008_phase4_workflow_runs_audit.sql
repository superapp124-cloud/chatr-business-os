-- Migration: Phase 4.2 — Rich Execution History & Append-Only Audit Log
-- Date: 2026-07-09

-- ── 1. Workflow Runs (Rich Operational Metadata) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Version lock: run is pinned to the version it was started with
  workflow_id uuid REFERENCES public.business_workflows(id) ON DELETE SET NULL,
  workflow_version_id uuid REFERENCES public.workflow_versions(id) ON DELETE SET NULL,
  
  -- Context
  trigger_type text, -- 'cron', 'webhook', 'manual', 'api', 'db_change', 'import'
  trigger_payload jsonb DEFAULT '{}'::jsonb,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid,
  
  -- Tracing (propagated to all child operations)
  correlation_id text NOT NULL DEFAULT gen_random_uuid()::text,
  
  -- State machine
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'waiting_approval', 'paused', 'completed', 'failed', 'cancelled', 'retrying')),
  current_node_id text,
  
  -- Execution trace: array of {node_id, started_at, completed_at, status, output, error}
  execution_trace jsonb DEFAULT '[]'::jsonb,
  
  -- Rich Performance Metrics
  duration_ms integer,
  queue_wait_ms integer,
  ai_inference_ms integer,
  approval_wait_ms integer,
  cpu_time_ms integer,
  
  -- Per-node timing: {node_id: duration_ms}
  node_durations jsonb DEFAULT '{}'::jsonb,
  provider_latencies jsonb DEFAULT '{}'::jsonb,
  
  -- State & Recovery
  memory_snapshot jsonb DEFAULT '{}'::jsonb, -- Runtime context snapshot for resume
  checkpoint_at timestamptz,
  queue_ids jsonb DEFAULT '[]'::jsonb, -- execution_queue IDs spawned by this run
  
  -- Failure details
  error_log text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  -- Diagnostics
  logs jsonb DEFAULT '[]'::jsonb,
  
  -- Timestamps
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workflow runs"
  ON public.workflow_runs FOR SELECT
  USING (started_by = auth.uid());

CREATE POLICY "Service role can manage all workflow runs"
  ON public.workflow_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_correlation_id ON public.workflow_runs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON public.workflow_runs(tenant_id);

-- ── 2. Append-Only Audit Log ──────────────────────────────────────────────
-- Strict: No RLS UPDATE or DELETE policies. Append-only.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- WHO
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  tenant_id uuid,
  
  -- WHAT
  action text NOT NULL, -- e.g. 'workflow.published', 'approval.granted', 'plugin.installed'
  resource_type text NOT NULL, -- e.g. 'workflow', 'plugin', 'user'
  resource_id text,
  
  -- CONTEXT
  correlation_id text, -- Links audit event to a specific workflow run
  before_snapshot jsonb, -- State before the action
  after_snapshot jsonb,  -- State after the action
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- WHEN (immutable)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Append-only: SELECT and INSERT only. No UPDATE, DELETE.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs scoped to their tenant"
  ON public.audit_logs FOR SELECT
  USING (actor_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Prevent any UPDATE or DELETE at the DB level
CREATE RULE no_update_audit_logs AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON public.audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
