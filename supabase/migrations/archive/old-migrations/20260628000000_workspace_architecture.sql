-- Create the core unified Workspace table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Workspace members (e.g. employees or team members)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Customer workspaces (the entity that unifies a customer's data)
CREATE TABLE IF NOT EXISTS public.workspace_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tags JSONB DEFAULT '[]'::jsonb,
  segment TEXT DEFAULT 'lead', -- e.g. VIP, lead, supplier
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workspace_id, profile_id)
);

-- Workspace Broadcasts
CREATE TABLE IF NOT EXISTS public.workspace_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  target_segment TEXT,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sent
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Workspace Templates
CREATE TABLE IF NOT EXISTS public.workspace_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g. offer, quotation, payment
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Workspace Activities (The Audit Trail)
CREATE TABLE IF NOT EXISTS public.workspace_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.workspace_customers(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- e.g. broadcast_sent, reply_received, task_created
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_activities ENABLE ROW LEVEL SECURITY;

-- Add triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_workspace_customers_updated_at BEFORE UPDATE ON public.workspace_customers FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_workspace_broadcasts_updated_at BEFORE UPDATE ON public.workspace_broadcasts FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_workspace_templates_updated_at BEFORE UPDATE ON public.workspace_templates FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
