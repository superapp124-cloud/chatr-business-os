-- Stage 1: Connect Everything (Production Validation)
-- Creates the 10 core tables required for Stage 1.

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. platform_events
CREATE TABLE IF NOT EXISTS platform_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id VARCHAR(255) NOT NULL, -- e.g., 'workflow_123', 'system'
    version BIGINT NOT NULL,         -- Optimistic concurrency
    type VARCHAR(255) NOT NULL,      -- e.g., 'WORKFLOW_STARTED', 'AI_INFERENCE_COMPLETE'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    execution_context JSONB NOT NULL DEFAULT '{}'::jsonb, -- Immutability Requirement (Execution ID, versions, OS, Correlation ID)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id, version)
);
CREATE INDEX idx_platform_events_stream ON platform_events(stream_id);
CREATE INDEX idx_platform_events_type ON platform_events(type);

-- 2. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES platform_events(id) ON DELETE CASCADE,
    actor VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. dead_letters
CREATE TABLE IF NOT EXISTS dead_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES platform_events(id) ON DELETE CASCADE,
    error_code VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. workflow_state
CREATE TABLE IF NOT EXISTS workflow_state (
    instance_id UUID PRIMARY KEY,
    definition_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED'
    current_node VARCHAR(255),
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    execution_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. workflow_checkpoints
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES workflow_state(instance_id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_workflow_checkpoints_instance ON workflow_checkpoints(instance_id);

-- 6. provider_runs
CREATE TABLE IF NOT EXISTS provider_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'TIMEOUT'
    latency_ms INT NOT NULL,
    execution_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. certification_history
CREATE TABLE IF NOT EXISTS certification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(255) NOT NULL,
    provider_version VARCHAR(255) NOT NULL,
    contract_version VARCHAR(255) NOT NULL,
    verdict VARCHAR(50) NOT NULL, -- 'CERTIFIED', 'NOT_CERTIFIED'
    report_data JSONB NOT NULL,
    release_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. benchmark_history
CREATE TABLE IF NOT EXISTS benchmark_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(255) NOT NULL,
    metric_name VARCHAR(255) NOT NULL, -- e.g., 'inference_latency'
    p50_val NUMERIC,
    p95_val NUMERIC,
    p99_val NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. workflow_metrics
CREATE TABLE IF NOT EXISTS workflow_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES workflow_state(instance_id) ON DELETE CASCADE,
    duration_ms INT NOT NULL,
    nodes_executed INT NOT NULL,
    tokens_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. ai_traces
CREATE TABLE IF NOT EXISTS ai_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES workflow_state(instance_id) ON DELETE SET NULL,
    provider_id VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    latency_ms INT NOT NULL,
    tokens_used INT NOT NULL DEFAULT 0,
    execution_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS setup (Assuming service_role is used by the backend kernel, but we secure public access)
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_traces ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view workflow data (restrict based on requirements later)
CREATE POLICY "Enable read for authenticated users" ON platform_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON workflow_state FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON ai_traces FOR SELECT USING (auth.role() = 'authenticated');

-- Enable Realtime for Event Bus UI syncing
ALTER PUBLICATION supabase_realtime ADD TABLE platform_events;
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_state;
