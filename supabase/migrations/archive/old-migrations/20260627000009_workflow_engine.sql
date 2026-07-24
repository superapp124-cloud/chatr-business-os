-- Phase 4: Universal Workflow Engine Core Schema

-- Workflow Templates (e.g. "Recruitment Workflow", "Legal Intake Workflow")
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    creator_id UUID REFERENCES public.profiles(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workflow Instances (An active session of a workflow, e.g. "Hiring John Doe")
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active, completed, paused, archived
    current_step INTEGER DEFAULT 1,
    context_data JSONB DEFAULT '{}'::jsonb, -- Store dynamic form data here
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workflow Steps (Definitions of tasks in a template)
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- form, approval, ai_action, notification
    config JSONB DEFAULT '{}'::jsonb, -- Schema for forms, prompts for AI, etc.
    required_role TEXT DEFAULT 'admin',
    UNIQUE(template_id, step_order)
);

-- Workflow Approvals (Tracking manual sign-offs for specific instances)
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instance_id UUID REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    step_id UUID REFERENCES public.workflow_steps(id),
    approver_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public templates are viewable by everyone" ON public.workflow_templates
    FOR SELECT USING (is_public = true OR auth.uid() = creator_id);

CREATE POLICY "Users can manage their own instances" ON public.workflow_instances
    FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Steps follow template visibility" ON public.workflow_steps
    FOR SELECT USING (true); -- Simplified for now

CREATE POLICY "Users can see their assigned approvals" ON public.workflow_approvals
    FOR SELECT USING (auth.uid() = approver_id OR auth.uid() IN (
        SELECT owner_id FROM public.workflow_instances WHERE id = instance_id
    ));
