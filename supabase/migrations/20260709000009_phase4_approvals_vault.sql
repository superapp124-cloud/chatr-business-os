-- Migration: Phase 4.3 — Advanced HITL Approvals, Vault & Recovery
-- Date: 2026-07-09

-- ── 1. Workflow Approvals (Multi-Step, SLA, Delegation) ───────────────────
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Context
  run_id uuid REFERENCES public.workflow_runs(id) ON DELETE CASCADE NOT NULL,
  workflow_id uuid REFERENCES public.business_workflows(id) ON DELETE SET NULL,
  node_id text NOT NULL, -- The suspended approval node
  correlation_id text,
  tenant_id uuid,
  
  -- Routing strategy
  routing_type text NOT NULL DEFAULT 'single'
    CHECK (routing_type IN ('single', 'multi_step', 'parallel', 'majority', 'role_based', 'escalation')),
  required_approvers integer DEFAULT 1, -- For majority/parallel
  
  -- Assignees
  assigned_to jsonb DEFAULT '[]'::jsonb, -- Array of user IDs or role names
  delegated_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Resolution
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'escalated', 'expired', 'overridden')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_comment text,
  
  -- SLA & Escalation
  sla_deadline timestamptz, -- Auto-reject if not resolved by this time
  escalate_after_hours integer DEFAULT 48,
  escalation_target uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminded_at timestamptz,
  
  -- Emergency override (audited separately)
  override_reason text,
  overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Approval history: array of {actor, action, comment, timestamp}
  approval_history jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assigned users can view and update approvals"
  ON public.workflow_approvals FOR ALL
  USING (auth.uid() = ANY (
    SELECT jsonb_array_elements_text(assigned_to)::uuid
  ) OR has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_run_id ON public.workflow_approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON public.workflow_approvals(status);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_sla ON public.workflow_approvals(sla_deadline) WHERE status = 'pending';

-- ── 2. Secrets Vault (Encrypted, Tenant-Isolated, Temporary Cred Pattern) ─
CREATE TABLE IF NOT EXISTS public.secrets_vault (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Ownership
  tenant_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Secret metadata (never store plaintext secrets in this table!)
  name text NOT NULL, -- Human-readable reference key, e.g. "stripe_api_key"
  description text,
  secret_type text NOT NULL CHECK (secret_type IN ('api_key', 'oauth_token', 'webhook_secret', 'db_credentials', 'custom')),
  
  -- The secret is encrypted at rest using Supabase Vault (pgsodium)
  -- This field stores the vault secret_id reference, NOT the plaintext
  vault_secret_id text NOT NULL,
  
  -- Access control
  allowed_plugins jsonb DEFAULT '[]'::jsonb, -- Plugin IDs that can request this secret
  allowed_capabilities jsonb DEFAULT '[]'::jsonb, -- Capability types that can use this
  
  -- Expiry
  expires_at timestamptz,
  last_accessed_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.secrets_vault ENABLE ROW LEVEL SECURITY;

-- Secrets are only accessible by admins and the service role
CREATE POLICY "Only admins can view secrets"
  ON public.secrets_vault FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage secrets"
  ON public.secrets_vault FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_secrets_vault_tenant ON public.secrets_vault(tenant_id);
CREATE INDEX IF NOT EXISTS idx_secrets_vault_type ON public.secrets_vault(secret_type);

-- ── 3. Update triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_approvals_updated_at
BEFORE UPDATE ON public.workflow_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_secrets_vault_updated_at
BEFORE UPDATE ON public.secrets_vault
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
