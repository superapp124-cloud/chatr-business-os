-- Milestone 2: Reality Platform Projections

-- Reality Entities (Temporal Projection)
CREATE TABLE IF NOT EXISTS reality_entities (
    id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    provenance_event_id UUID NOT NULL REFERENCES os_events(id),
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31 23:59:59+00'::timestamptz,
    PRIMARY KEY (id, effective_from)
);

CREATE INDEX idx_reality_entities_type ON reality_entities(entity_type);
CREATE INDEX idx_reality_entities_temporal ON reality_entities(id, effective_from, effective_to);

-- Reality Relationships (Temporal Projection)
CREATE TABLE IF NOT EXISTS reality_relationships (
    id UUID NOT NULL,
    source_entity_id UUID NOT NULL,
    target_entity_id UUID NOT NULL,
    relation_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    provenance_event_id UUID NOT NULL REFERENCES os_events(id),
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31 23:59:59+00'::timestamptz,
    PRIMARY KEY (id, effective_from)
);

CREATE INDEX idx_reality_rels_source ON reality_relationships(source_entity_id);
CREATE INDEX idx_reality_rels_target ON reality_relationships(target_entity_id);
CREATE INDEX idx_reality_rels_temporal ON reality_relationships(id, effective_from, effective_to);

-- Since these are projections, the database policies can allow updates for closing temporal windows
ALTER TABLE reality_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reality_relationships ENABLE ROW LEVEL SECURITY;

-- Allow selects on active projections
CREATE POLICY "Allow selects on active reality_entities" ON reality_entities 
    FOR SELECT USING (effective_to = '9999-12-31 23:59:59+00'::timestamptz);
    
CREATE POLICY "Allow selects on active reality_relationships" ON reality_relationships 
    FOR SELECT USING (effective_to = '9999-12-31 23:59:59+00'::timestamptz);

-- (In a fully locked-down environment, only the background Projector Role would have INSERT/UPDATE access)
CREATE POLICY "Allow projection role insert/update entities" ON reality_entities 
    FOR ALL USING (true) WITH CHECK (true);
    
CREATE POLICY "Allow projection role insert/update relationships" ON reality_relationships 
    FOR ALL USING (true) WITH CHECK (true);
