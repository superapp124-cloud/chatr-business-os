-- Migration: Experience Provider Data Models
-- Purpose: Support multi-dimensional user experiences without changing core OS logic

CREATE TABLE IF NOT EXISTS public.workspace_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- e.g., 'HR', 'Finance', 'Personal'
    description TEXT,
    layout_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_dimensions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dimension_type TEXT NOT NULL, -- e.g., 'role', 'preference', 'department'
    dimension_value TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.workspace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dimensions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.workspace_templates FOR SELECT USING (true);
CREATE POLICY "Users can view their own dimensions" ON public.user_dimensions FOR SELECT USING (auth.uid() = user_id);
