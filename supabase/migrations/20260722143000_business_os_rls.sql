-- Business OS RLS Security Hardening

-- 1. Enable Row Level Security globally on all OS tables
ALTER TABLE sys_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_tenant_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE sys_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_event_store ENABLE ROW LEVEL SECURITY;

-- 2. Organization Policies
-- Users can only see their own organization based on sys_tenant_users
CREATE POLICY "Tenant users can view their organization"
ON sys_organizations
FOR SELECT
USING (
    id IN (
        SELECT organization_id FROM sys_tenant_users WHERE user_id = auth.uid()
    )
);

-- 3. Module & Entity Policies
CREATE POLICY "Tenant users can view org modules"
ON sys_modules
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM sys_tenant_users WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Tenant users can view org entities"
ON sys_entities
FOR SELECT
USING (
    module_id IN (
        SELECT id FROM sys_modules WHERE organization_id IN (
            SELECT organization_id FROM sys_tenant_users WHERE user_id = auth.uid()
        )
    )
);

-- 4. Event Store Audit Policies
-- No user can UPDATE or DELETE from the Event Store (Immutable)
CREATE POLICY "Event Store is append-only for users"
ON sys_event_store
FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM sys_tenant_users WHERE user_id = auth.uid()
    )
    AND actor_id = auth.uid()
);

CREATE POLICY "Event Store cannot be updated"
ON sys_event_store
FOR UPDATE
USING (false);

CREATE POLICY "Event Store cannot be deleted"
ON sys_event_store
FOR DELETE
USING (false);

CREATE POLICY "Tenant users can read their org events"
ON sys_event_store
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM sys_tenant_users WHERE user_id = auth.uid()
    )
);

-- 5. Strict Data Isolation
-- This pattern is repeated across all capability tables to guarantee data never leaks across tenants
