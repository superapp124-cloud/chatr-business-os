-- Migration: Phase 4.1 — Immutable Workflow Versioning
-- Date: 2026-07-09
-- Semantic versioning (major.minor.patch) + immutable published snapshots

-- ── 1. Extend business_workflows with lifecycle state ─────────────────────
ALTER TABLE public.business_workflows
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft', 'published', 'archived', 'deprecated')),
  ADD COLUMN IF NOT EXISTS active_version_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_id uuid; -- for enterprise multi-tenancy

-- ── 2. Workflow Versions (immutable once published) ────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES public.business_workflows(id) ON DELETE CASCADE,
  
  -- Semantic versioning
  semver text NOT NULL, -- e.g. "1.0.0", "1.1.0", "2.0.0"
  version_number integer NOT NULL DEFAULT 1,
  
  -- Immutable snapshot of graph at publish time
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Version metadata
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived', 'deprecated')),
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_summary text,
  published_notes text,
  migration_notes text, -- Breaking change instructions for downstream consumers
  
  -- Traceability
  tenant_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),

  -- Only one published version per workflow at a time
  UNIQUE (workflow_id, semver)
);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workflow versions"
  ON public.workflow_versions FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON public.workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_status ON public.workflow_versions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_tenant ON public.workflow_versions(tenant_id);
