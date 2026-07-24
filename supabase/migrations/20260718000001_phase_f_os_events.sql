-- Milestone 1: Immutable Event Platform

-- Create the os_events table which acts as the ultimate source of truth
CREATE TABLE IF NOT EXISTS os_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
    source_subsystem TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1.0),
    verification_status TEXT CHECK (verification_status IN ('unverified', 'verified', 'failed')),
    provenance TEXT,
    
    schema_version TEXT NOT NULL DEFAULT '1.0',
    producer_version TEXT NOT NULL DEFAULT '1.0',
    platform_version TEXT NOT NULL DEFAULT '1.0',
    
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Index for temporal replay and queries
CREATE INDEX idx_os_events_timestamp ON os_events(timestamp);
CREATE INDEX idx_os_events_type ON os_events(event_type);
CREATE INDEX idx_os_events_source ON os_events(source_subsystem);

-- APPEND-ONLY ENFORCEMENT
-- 1. Row Level Security
ALTER TABLE os_events ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated OS services (or users)
CREATE POLICY "Allow inserts to os_events" ON os_events 
    FOR INSERT 
    WITH CHECK (true);

-- Allow selects
CREATE POLICY "Allow selects on os_events" ON os_events 
    FOR SELECT 
    USING (true);

-- Explicitly deny UPDATE and DELETE
CREATE POLICY "Deny updates to os_events" ON os_events 
    FOR UPDATE 
    USING (false);

CREATE POLICY "Deny deletes to os_events" ON os_events 
    FOR DELETE 
    USING (false);

-- 2. Database Trigger for Hard Enforcement (prevents even superusers from modifying history accidentally)
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'The os_events table is append-only. UPDATE and DELETE operations are strictly prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_os_events_append_only
BEFORE UPDATE OR DELETE ON os_events
FOR EACH ROW
EXECUTE FUNCTION enforce_append_only();
