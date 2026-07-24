-- ============================================================
-- CHATR Platform: Knowledge Graph Domain
-- Migration: 20260701000003_platform_knowledge.sql
-- ============================================================

-- Knowledge Nodes (every entity in the platform becomes a node)
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'message', 'task', 'meeting', 'file', 'person', 'concept'
  entity_id UUID, -- FK to the source table
  title TEXT NOT NULL,
  summary TEXT,
  raw_content TEXT, -- full text for search
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge Edges (relationships between nodes)
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'mentioned_in', 'assigned_to', 'relates_to', 'created_by', 'follows_from'
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_node_id, to_node_id, relationship_type)
);

-- Knowledge Processing Queue (async processing via EventBus)
CREATE TABLE IF NOT EXISTS public.knowledge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- mirrors EventBus event types
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Search Index (full-text search across all entity types)
CREATE TABLE IF NOT EXISTS public.search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  search_vector TSVECTOR,
  title TEXT,
  preview TEXT, -- short preview for display in search results
  url_path TEXT, -- deep link into the app
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

-- RLS
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Workspace members can view knowledge nodes" ON public.knowledge_nodes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = knowledge_nodes.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Services can write knowledge nodes" ON public.knowledge_nodes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = knowledge_nodes.workspace_id AND user_id = auth.uid())
);
CREATE POLICY "Workspace members can view edges" ON public.knowledge_edges FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = knowledge_edges.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Workspace members can write edges" ON public.knowledge_edges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = knowledge_edges.workspace_id AND user_id = auth.uid())
);
CREATE POLICY "Workspace members can view search index" ON public.search_index FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = search_index.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Services can update search index" ON public.search_index FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = search_index.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Knowledge events are workspace-scoped" ON public.knowledge_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = knowledge_events.workspace_id AND user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_workspace ON public.knowledge_nodes(workspace_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_entity ON public.knowledge_nodes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from ON public.knowledge_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_to ON public.knowledge_edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_events_unprocessed ON public.knowledge_events(processed, created_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_search_index_workspace ON public.search_index(workspace_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_search_vector ON public.search_index USING GIN(search_vector);

-- Full-text search function
CREATE OR REPLACE FUNCTION public.search_workspace(
  p_workspace_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE(entity_type TEXT, entity_id UUID, title TEXT, preview TEXT, url_path TEXT, rank FLOAT4)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.entity_type,
    si.entity_id,
    si.title,
    si.preview,
    si.url_path,
    ts_rank(si.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM public.search_index si
  WHERE si.workspace_id = p_workspace_id
    AND si.search_vector @@ websearch_to_tsquery('english', p_query)
    AND (p_entity_types IS NULL OR si.entity_type = ANY(p_entity_types))
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$;

-- Triggers
CREATE TRIGGER update_knowledge_nodes_updated_at BEFORE UPDATE ON public.knowledge_nodes FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_search_index_updated_at BEFORE UPDATE ON public.search_index FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
