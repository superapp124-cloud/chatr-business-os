-- Enable RLS on core OS tables
ALTER TABLE os_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Intent Isolation
-- Tenants can only select and update their own intents
CREATE POLICY "Tenant isolation for intents select" ON os_intents
  FOR SELECT USING (
    tenant_id = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

CREATE POLICY "Tenant isolation for intents insert" ON os_intents
  FOR INSERT WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

CREATE POLICY "Tenant isolation for intents update" ON os_intents
  FOR UPDATE USING (
    tenant_id = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

-- 2. Event Log Isolation
-- Tenants can only see and write events associated with their own tenants
CREATE POLICY "Tenant isolation for events select" ON os_events
  FOR SELECT USING (
    (metadata->>'tenantId') = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

CREATE POLICY "Tenant isolation for events insert" ON os_events
  FOR INSERT WITH CHECK (
    (metadata->>'tenantId') = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

-- 3. Audit Log Isolation
CREATE POLICY "Tenant isolation for audit select" ON os_audit_logs
  FOR SELECT USING (
    tenant_id = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

CREATE POLICY "Tenant isolation for audit insert" ON os_audit_logs
  FOR INSERT WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims')::json->>'tenant_id')
  );

-- 4. System Bypass (Service Role)
-- Service Role (used by RecoveryEngine) naturally bypasses RLS, so no explicit policy is needed for the system role.
