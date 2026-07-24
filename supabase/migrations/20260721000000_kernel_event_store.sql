-- ----------------------------------------------------------------------------
-- CHATR OS Kernel - Event Store
-- 
-- The ultimate system of record for enterprise truth. No mutations occur
-- in the kernel without an event being appended to this immutable ledger.
-- ----------------------------------------------------------------------------

CREATE TABLE kernel_events (
    global_sequence BIGSERIAL PRIMARY KEY,           -- Monotonically increasing, for projection replay
    event_id UUID NOT NULL DEFAULT gen_random_uuid(), -- Globally unique event ID
    
    stream_id TEXT NOT NULL,                         -- e.g., "urn:chatr:object:candidate:123"
    aggregate_type TEXT NOT NULL,                    -- e.g., "Candidate", "Laptop"
    aggregate_id TEXT NOT NULL,                      -- e.g., "123"
    expected_version BIGINT NOT NULL,                -- Optimistic concurrency control (0 for creation)
    
    event_type TEXT NOT NULL,                        -- e.g., "CandidateCreated"
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    actor_id TEXT NOT NULL,                          -- Who triggered this (urn:chatr:actor:employee:456)
    tenant_id TEXT NOT NULL,                         -- Multi-tenancy isolation
    
    correlation_id TEXT,                             -- Tracing across distributed transactions
    causation_id TEXT,                               -- The event_id that caused this event
    
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,      -- The delta or state change
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,     -- IP, User Agent, context
    
    UNIQUE(stream_id, expected_version)              -- Guarantees optimistic concurrency (no overwriting history)
);

-- Indexes for querying by aggregate, type, and temporal order
CREATE INDEX idx_kernel_events_stream ON kernel_events (stream_id, expected_version);
CREATE INDEX idx_kernel_events_type ON kernel_events (event_type);
CREATE INDEX idx_kernel_events_tenant ON kernel_events (tenant_id, timestamp);
CREATE INDEX idx_kernel_events_actor ON kernel_events (actor_id);
CREATE INDEX idx_kernel_events_aggregate ON kernel_events (aggregate_type, aggregate_id);

-- Enforce immutability (No UPDATE or DELETE allowed)
CREATE OR REPLACE FUNCTION prevent_kernel_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Kernel Events are immutable. UPDATE and DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_kernel_event_update
BEFORE UPDATE ON kernel_events
FOR EACH ROW EXECUTE FUNCTION prevent_kernel_event_mutation();

CREATE TRIGGER trg_prevent_kernel_event_delete
BEFORE DELETE ON kernel_events
FOR EACH ROW EXECUTE FUNCTION prevent_kernel_event_mutation();

-- Enable Row Level Security (RLS)
ALTER TABLE kernel_events ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be defined by the Policy Engine, 
-- but for the kernel service role, we grant full read/insert access.
