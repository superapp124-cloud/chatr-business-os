-- Milestone 3: Knowledge Platform Projection

CREATE TABLE IF NOT EXISTS knowledge_kernel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('fact', 'experience', 'heuristic', 'prediction', 'explanation', 'policy')),
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Context references
    reality_entity_ids UUID[] NOT NULL DEFAULT '{}',
    timeframe_start TIMESTAMPTZ,
    timeframe_end TIMESTAMPTZ,
    
    -- Provenance (Link back to the immutable event that projected this knowledge)
    provenance_event_id UUID NOT NULL REFERENCES os_events(id),
    confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1.0),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast knowledge retrieval by entity and type
CREATE INDEX idx_knowledge_type ON knowledge_kernel(knowledge_type);
CREATE INDEX idx_knowledge_entities ON knowledge_kernel USING GIN (reality_entity_ids);
CREATE INDEX idx_knowledge_provenance ON knowledge_kernel(provenance_event_id);

-- Enforce strict Projection-only mutation rules
ALTER TABLE knowledge_kernel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow selects on knowledge_kernel" ON knowledge_kernel 
    FOR SELECT USING (true);

-- As with reality_entities, only the Projector Role should INSERT.
-- Furthermore, knowledge_kernel is functionally append-only because it represents cumulative learning, 
-- though heuristics might be superseded by newer heuristics. 
-- We explicitly forbid UPDATE and DELETE to ensure knowledge history is preserved.
CREATE POLICY "Deny updates to knowledge_kernel" ON knowledge_kernel 
    FOR UPDATE USING (false);

CREATE POLICY "Deny deletes to knowledge_kernel" ON knowledge_kernel 
    FOR DELETE USING (false);

CREATE POLICY "Allow projection role insert knowledge" ON knowledge_kernel 
    FOR INSERT WITH CHECK (true);
