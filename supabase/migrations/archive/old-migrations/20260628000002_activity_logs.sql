-- Create the ENUM for entity types
CREATE TYPE activity_entity_type AS ENUM ('candidate', 'requisition', 'call', 'system', 'project');

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- The actor
    entity_type activity_entity_type NOT NULL,
    entity_id UUID, -- Optional, links to the specific record
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast queries
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Activity logs are globally readable by all authenticated users in this architecture
-- (since it's a team workspace/timeline)
CREATE POLICY "Users can view all activity logs"
    ON public.activity_logs
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Anyone can insert an activity log
CREATE POLICY "Users can insert activity logs"
    ON public.activity_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- Grant permissions
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;
