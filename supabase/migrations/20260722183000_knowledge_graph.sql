-- CHATR Business OS v1.0 — Knowledge Graph Persistence
-- Replaces in-memory Map with a tenant-isolated Supabase graph store.
--
-- Tables:
--   kg_nodes  — entities (Person, Company, Document, Meeting, Project, Invoice)
--   kg_edges  — relationships between nodes (BELONGS_TO, CREATED, ATTENDED, etc.)

-- ─── Nodes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kg_nodes (
    id TEXT PRIMARY KEY,                            -- e.g. 'lead_abc123', 'comp_acme_corp'
    tenant_id TEXT NOT NULL,                        -- RLS: auth.uid()
    node_type TEXT NOT NULL CHECK (node_type IN (
        'PERSON', 'COMPANY', 'DOCUMENT',
        'MEETING', 'PROJECT', 'INVOICE'
    )),
    name TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_capability TEXT,                         -- e.g. 'CRM.Leads', 'Finance.Invoicing'
    source_object_id TEXT,                          -- ID of the originating business object
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_tenant
    ON kg_nodes (tenant_id, node_type);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_name
    ON kg_nodes USING gin(to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_kg_nodes_metadata
    ON kg_nodes USING gin(metadata);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION kg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kg_nodes_updated_at
    BEFORE UPDATE ON kg_nodes
    FOR EACH ROW EXECUTE FUNCTION kg_set_updated_at();

-- RLS
ALTER TABLE kg_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kg_nodes_tenant_select" ON kg_nodes
    FOR SELECT USING (auth.uid()::text = tenant_id);

CREATE POLICY "kg_nodes_tenant_insert" ON kg_nodes
    FOR INSERT WITH CHECK (auth.uid()::text = tenant_id);

CREATE POLICY "kg_nodes_tenant_update" ON kg_nodes
    FOR UPDATE USING (auth.uid()::text = tenant_id)
    WITH CHECK (auth.uid()::text = tenant_id);

CREATE POLICY "kg_nodes_tenant_delete" ON kg_nodes
    FOR DELETE USING (auth.uid()::text = tenant_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kg_nodes;

-- ─── Edges ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kg_edges (
    id TEXT PRIMARY KEY,                            -- e.g. 'edge_1753200000000'
    tenant_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
    target_node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
    relation TEXT NOT NULL CHECK (relation IN (
        'BELONGS_TO', 'ATTENDED', 'CREATED',
        'SIGNED', 'ASSIGNED_TO'
    )),
    weight NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_tenant
    ON kg_edges (tenant_id, source_node_id);

CREATE INDEX IF NOT EXISTS idx_kg_edges_target
    ON kg_edges (tenant_id, target_node_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kg_edges_unique_rel
    ON kg_edges (tenant_id, source_node_id, target_node_id, relation);

-- RLS
ALTER TABLE kg_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kg_edges_tenant_select" ON kg_edges
    FOR SELECT USING (auth.uid()::text = tenant_id);

CREATE POLICY "kg_edges_tenant_insert" ON kg_edges
    FOR INSERT WITH CHECK (auth.uid()::text = tenant_id);

CREATE POLICY "kg_edges_tenant_delete" ON kg_edges
    FOR DELETE USING (auth.uid()::text = tenant_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kg_edges;
