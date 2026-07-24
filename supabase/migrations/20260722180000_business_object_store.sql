-- CHATR Business OS v1.0 — Generic Business Object Store
-- Replaces localStorage-backed BusinessObjectStore with a real Supabase table.
-- Every capability (CRM, HR, Finance, Operations, etc.) persists records here.
-- Tenant-isolated via RLS using auth.uid().

CREATE TABLE IF NOT EXISTS bos_records (
    -- Primary identity
    id TEXT PRIMARY KEY,                              -- Format: objectName_timestamp_random
    capability_id TEXT NOT NULL,                      -- e.g. 'Finance.Invoicing', 'CRM.Leads'
    object_name TEXT NOT NULL,                        -- e.g. 'Invoice', 'Lead', 'Employee'
    tenant_id TEXT NOT NULL,                          -- Matches auth.uid() for single-user orgs
    
    -- Record data (flexible JSONB — mirrors localStorage schema exactly)
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Lifecycle fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,                           -- NULL = active, set = soft-deleted
    archived_at TIMESTAMPTZ,                          -- NULL = active, set = archived
    created_by TEXT NOT NULL DEFAULT 'system',
    
    -- History / audit trail
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- State machine current status
    current_status TEXT,
    pending_policy TEXT
);

-- Indexes for fast queries by tenant + capability + object type
CREATE INDEX IF NOT EXISTS idx_bos_capability 
    ON bos_records (tenant_id, capability_id, object_name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bos_status 
    ON bos_records (tenant_id, capability_id, object_name, current_status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bos_created 
    ON bos_records (tenant_id, created_at DESC);

-- GIN index for full JSONB search
CREATE INDEX IF NOT EXISTS idx_bos_data_gin 
    ON bos_records USING gin(data);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION bos_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bos_updated_at
    BEFORE UPDATE ON bos_records
    FOR EACH ROW EXECUTE FUNCTION bos_set_updated_at();

-- Enable Row Level Security
ALTER TABLE bos_records ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only see their own tenant's records
CREATE POLICY "bos_tenant_select" ON bos_records
    FOR SELECT
    USING (auth.uid()::text = tenant_id);

CREATE POLICY "bos_tenant_insert" ON bos_records
    FOR INSERT
    WITH CHECK (auth.uid()::text = tenant_id);

CREATE POLICY "bos_tenant_update" ON bos_records
    FOR UPDATE
    USING (auth.uid()::text = tenant_id)
    WITH CHECK (auth.uid()::text = tenant_id);

-- No hard DELETE via RLS — use soft delete (deleted_at) instead
-- Hard deletes go through service role only

-- Add to realtime publication so UI gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE bos_records;
