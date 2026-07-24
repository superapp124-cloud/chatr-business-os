-- Migration: Phase C - Enterprise Lifecycle
-- Updates existing workflow_versions table for immutable workflow manifests
-- Updates business_workflows with active_version_id foreign key

-- Add new columns to the existing workflow_versions table
ALTER TABLE public.workflow_versions
ADD COLUMN IF NOT EXISTS manifest JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS graph_checksum TEXT,
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'published', 'deprecated', 'yanked')) DEFAULT 'published',
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES public.workflow_versions(id);

COMMENT ON COLUMN public.workflow_versions.manifest IS 'The immutable WorkflowManifest ABI object.';

CREATE INDEX IF NOT EXISTS idx_workflow_versions_checksum ON public.workflow_versions(graph_checksum);

-- Add active_version_id to business_workflows if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='business_workflows' AND column_name='active_version_id'
  ) THEN 
    ALTER TABLE public.business_workflows 
    ADD COLUMN active_version_id UUID REFERENCES public.workflow_versions(id) ON DELETE SET NULL;
  END IF; 
END $$;

COMMENT ON COLUMN public.business_workflows.active_version_id IS 'Points to the currently active production version in workflow_versions.';
