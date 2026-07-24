-- Milestone 4: Outcome Platform

-- The Outcome Verification Table
-- This records the result of verifying an expected reality change.
CREATE TABLE IF NOT EXISTS outcome_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expected_outcome JSONB NOT NULL,
    observed_outcome JSONB,
    
    -- Three-state verification is mandatory. Never 'success'/'failure'
    status TEXT NOT NULL CHECK (status IN ('verified', 'rejected', 'inconclusive')),
    
    verification_method TEXT NOT NULL,
    verifier_subsystem TEXT NOT NULL,
    confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1.0),
    
    -- Remaining unknowns preserve uncertainty
    remaining_unknowns JSONB DEFAULT '[]'::jsonb,
    
    -- Provenance back to the event that triggered the observation
    source_event_id UUID NOT NULL REFERENCES os_events(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outcome_status ON outcome_verifications(status);

-- The Goal Progress Table
-- Goals are only advanced when verified evidence exists.
CREATE TABLE IF NOT EXISTS goal_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL, -- Logical reference to a Goal entity in Reality Graph
    
    -- Evidence required for advancement
    verification_id UUID NOT NULL REFERENCES outcome_verifications(id),
    
    progress_percentage INTEGER NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    narrative_explanation TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goal_progress_goal ON goal_progress(goal_id);

-- Enforce strict Projection-only mutation rules (Append Only)
ALTER TABLE outcome_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow selects on outcome_verifications" ON outcome_verifications FOR SELECT USING (true);
CREATE POLICY "Allow selects on goal_progress" ON goal_progress FOR SELECT USING (true);

-- Append-only constraints
CREATE POLICY "Deny updates to outcome_verifications" ON outcome_verifications FOR UPDATE USING (false);
CREATE POLICY "Deny deletes to outcome_verifications" ON outcome_verifications FOR DELETE USING (false);

CREATE POLICY "Deny updates to goal_progress" ON goal_progress FOR UPDATE USING (false);
CREATE POLICY "Deny deletes to goal_progress" ON goal_progress FOR DELETE USING (false);

CREATE POLICY "Allow projection role insert" ON outcome_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow projection role insert" ON goal_progress FOR INSERT WITH CHECK (true);
