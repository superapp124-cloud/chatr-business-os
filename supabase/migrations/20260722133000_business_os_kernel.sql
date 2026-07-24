-- Business OS Kernel Migration
-- Sets up Hierarchical Multi-Tenancy, Metadata Graph, Business Graph, 4-Tier AI Memory, and Event Store

-- 1. Hierarchical Multi-Tenancy
CREATE TABLE IF NOT EXISTS sys_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id UUID NOT NULL REFERENCES sys_business_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES sys_departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES sys_teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES sys_workspaces(id) ON DELETE CASCADE,
    team_id UUID REFERENCES sys_teams(id) ON DELETE CASCADE,
    department_id UUID REFERENCES sys_departments(id) ON DELETE CASCADE,
    business_unit_id UUID REFERENCES sys_business_units(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES sys_organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Condensed Metadata Graph
CREATE TABLE IF NOT EXISTS sys_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES sys_modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    state_machine_json JSONB DEFAULT '{}'::jsonb, -- State machine definition
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES sys_entities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    validation_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES sys_entities(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'form', 'table', 'card', 'kanban', etc.
    name TEXT NOT NULL,
    layout_json JSONB DEFAULT '{}'::jsonb,
    theme_json JSONB DEFAULT '{}'::jsonb,
    behavior_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES sys_entities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    workflow_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL, -- 'module', 'entity', 'attribute', 'view'
    target_id UUID NOT NULL,
    role TEXT NOT NULL,
    permissions_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_ai_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    capability_type TEXT NOT NULL, -- e.g. 'Text Generation'
    preferred_provider TEXT NOT NULL,
    fallback_allowed BOOLEAN DEFAULT false,
    fallback_provider TEXT,
    policy_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Business Graph (Runtime Nodes & Edges)
CREATE TABLE IF NOT EXISTS sys_business_graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES sys_entities(id) ON DELETE CASCADE,
    record_id UUID NOT NULL, -- ID of the actual record in the business table
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_business_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES sys_business_graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES sys_business_graph_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 4-Tier Memory (RAG)
CREATE TABLE IF NOT EXISTS ai_memory_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding JSONB, -- Stored as JSON array for fallback
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_memory_conversation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    participants JSONB NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_memory_business (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    record_id UUID NOT NULL,
    entity_id UUID NOT NULL REFERENCES sys_entities(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_memory_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    document_id UUID,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Event Store
CREATE TABLE IF NOT EXISTS sys_event_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES sys_organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL, -- e.g. Record ID, Module ID
    aggregate_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1, -- For Event Sourcing / Operational Queue conflicts
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sys_event_store_aggregate ON sys_event_store(aggregate_id, aggregate_type);
CREATE INDEX IF NOT EXISTS idx_sys_business_edges_source ON sys_business_graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_sys_business_edges_target ON sys_business_graph_edges(target_node_id);
