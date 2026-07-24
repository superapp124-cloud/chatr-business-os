-- OS Kernel Foundation (Phase A Core Runtime)

-- 1. Departments & Capabilities
CREATE TABLE os_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tenant_id UUID NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE os_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES os_departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'core', 'scalable'
    version TEXT DEFAULT '1.0.0',
    status TEXT DEFAULT 'active',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Universal Work Object (The Base Entity for EVERYTHING)
CREATE TABLE os_work_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'decision', 'okr', 'lead', 'ticket'
    department_id UUID REFERENCES os_departments(id),
    capability_id UUID REFERENCES os_capabilities(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    priority TEXT DEFAULT 'medium',
    owner_id UUID REFERENCES auth.users(id),
    workflow_id UUID,
    timeline_id UUID,
    permissions JSONB DEFAULT '{}'::jsonb,
    knowledge_links JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb, -- Domain specific data (e.g., decision outcome)
    tenant_id UUID NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Intents (Natural Language Commands)
CREATE TABLE os_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_text TEXT NOT NULL,
    detected_intent TEXT,
    capability_id UUID REFERENCES os_capabilities(id),
    resolved_action TEXT,
    status TEXT DEFAULT 'pending',
    execution_log JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Workflows (Execution Engine)
CREATE TABLE os_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    conditions JSONB DEFAULT '[]'::jsonb,
    steps JSONB NOT NULL,
    status TEXT DEFAULT 'active',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Event Bus (System Source of Truth)
CREATE TABLE os_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    source TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Universal Audit Log
CREATE TABLE os_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    actor_id UUID REFERENCES auth.users(id),
    ip_address TEXT,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_os_work_objects_tenant_type ON os_work_objects(tenant_id, type);
CREATE INDEX idx_os_events_tenant_type ON os_events(tenant_id, event_type);
CREATE INDEX idx_os_audit_logs_entity ON os_audit_logs(entity_type, entity_id);

-- RLS Policies Setup
ALTER TABLE os_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_work_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON os_work_objects FOR ALL USING (
  tenant_id = (SELECT (raw_user_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
);
CREATE POLICY "Tenant Isolation" ON os_events FOR ALL USING (
  tenant_id = (SELECT (raw_user_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
);

-- Enable Realtime for Events (This powers the UI Hooks)
ALTER PUBLICATION supabase_realtime ADD TABLE os_events;
