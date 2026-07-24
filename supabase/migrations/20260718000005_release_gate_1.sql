-- Release Gate 1: P0 Vulnerability Mitigations

-- -----------------------------------------------------------------------------
-- P0 #1: Database-level Idempotency
-- -----------------------------------------------------------------------------
-- In order to prevent concurrent race conditions from producing duplicate events,
-- we move idempotency enforcement directly to the database kernel.

ALTER TABLE os_events ADD COLUMN idempotency_key TEXT;
ALTER TABLE os_events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'SYSTEM';

-- Unique constraint scoped to the logical business boundary.
CREATE UNIQUE INDEX idx_os_events_idempotency 
    ON os_events (tenant_id, source_subsystem, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- P0 #2: Distributed Projection Watermarks
-- -----------------------------------------------------------------------------
-- In order to prevent projection checkpoint divergence during replay SIGKILLs,
-- projectors must commit their progress transactionally to this table.
-- This allows each projector to independently track its "Last Applied Event"
-- without forcing the entire replay to rewind to the slowest subsystem.

CREATE TABLE IF NOT EXISTS projection_watermarks (
    projector_name TEXT PRIMARY KEY,
    
    -- The cursor
    last_applied_event_id UUID NOT NULL REFERENCES os_events(id),
    
    -- Diagnostic Metadata
    projector_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    projection_checksum TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'rebuilding', 'failed', 'paused')),
    replay_job_id UUID,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Enforcement
ALTER TABLE projection_watermarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow selects on projection_watermarks" ON projection_watermarks FOR SELECT USING (true);
CREATE POLICY "Allow projection role insert/update watermarks" ON projection_watermarks FOR ALL USING (true) WITH CHECK (true);
