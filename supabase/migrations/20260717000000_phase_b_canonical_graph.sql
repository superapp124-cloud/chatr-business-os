-- Migration: Phase B - Canonical Workflow Graph Persistence
-- Adds a generic `graph` JSONB column to `business_workflows` as the single source of truth.
-- Preserves existing `nodes` and `edges` for backward compatibility during the transition.

ALTER TABLE public.business_workflows
ADD COLUMN graph JSONB DEFAULT '{}'::jsonb;

-- Comment to describe the column
COMMENT ON COLUMN public.business_workflows.graph IS 'Canonical WorkflowGraph ABI format storing nodes, edges, layout, and metadata.';

-- Optional: Create an index on the graph id or schema version if needed for queries later
CREATE INDEX idx_business_workflows_graph_schema ON public.business_workflows ((graph->>'schemaVersion'));
