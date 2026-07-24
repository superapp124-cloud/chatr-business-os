-- Migration: Phase 5.2 — Layered Policy Engine
-- Date: 2026-07-09
-- Policies cascade: Global → Organization → Workspace → Workflow → Capability

CREATE TABLE IF NOT EXISTS public.org_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Ownership & Hierarchy
  tenant_id uuid, -- NULL = Global platform policy
  workspace_id uuid, -- NULL = applies to whole org
  workflow_id uuid REFERENCES public.business_workflows(id) ON DELETE CASCADE, -- NULL = applies to workspace
  capability text, -- NULL = applies to all capabilities
  
  -- Identity
  name text NOT NULL,
  description text,
  
  -- What this policy governs
  scope text NOT NULL CHECK (scope IN ('global', 'organization', 'workspace', 'workflow', 'capability', 'plugin', 'user')),
  
  -- The condition rule (jsonb predicate evaluated at runtime)
  -- Examples:
  --   {"type": "capability_limit", "max": 5}
  --   {"type": "network_destination", "blocked": ["api.openai.com"]}
  --   {"type": "execution_rate", "max_per_minute": 10}
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- What happens when the rule is violated
  enforcement text NOT NULL DEFAULT 'block'
    CHECK (enforcement IN ('allow', 'warn', 'require_approval', 'delay', 'rate_limit', 'quarantine', 'block', 'audit')),
  
  -- For 'require_approval' enforcement: who must approve
  approval_group jsonb DEFAULT '[]'::jsonb,
  
  -- For 'rate_limit': delay in seconds
  delay_seconds integer,
  
  -- For 'rate_limit': window and max count
  rate_limit_window_seconds integer,
  rate_limit_max_count integer,
  
  -- Active state
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100, -- Lower = evaluated first
  
  -- Audit
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.org_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all policies"
  ON public.org_policies FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view enabled policies in their org"
  ON public.org_policies FOR SELECT
  USING (enabled = true);

CREATE INDEX IF NOT EXISTS idx_org_policies_scope ON public.org_policies(scope);
CREATE INDEX IF NOT EXISTS idx_org_policies_tenant ON public.org_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_policies_priority ON public.org_policies(priority, enabled);
CREATE INDEX IF NOT EXISTS idx_org_policies_workflow ON public.org_policies(workflow_id) WHERE workflow_id IS NOT NULL;

CREATE TRIGGER trigger_org_policies_updated_at
BEFORE UPDATE ON public.org_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
