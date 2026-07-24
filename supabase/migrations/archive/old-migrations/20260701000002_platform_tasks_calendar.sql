-- ============================================================
-- CHATR Platform: Tasks & Calendar Domain
-- Migration: 20260701000002_platform_tasks_calendar.sql
-- ============================================================

-- Task Lists
CREATE TABLE IF NOT EXISTS public.task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Tasks',
  color TEXT DEFAULT '#6366f1',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES public.task_lists(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE, -- subtasks
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  sort_order FLOAT DEFAULT 0, -- for drag-and-drop reorder
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task Comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendar Events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  location TEXT,
  meeting_url TEXT,
  color TEXT DEFAULT '#6366f1',
  event_type TEXT DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'deadline', 'reminder', 'sync', 'review', 'other')),
  recurrence JSONB, -- { freq: 'weekly', interval: 1, until: '2026-12-31' }
  external_id TEXT, -- for Google/Outlook sync
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event Attendees
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- RLS
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Task list policies
CREATE POLICY "Workspace members can view task lists" ON public.task_lists FOR SELECT
  USING (owner_id = auth.uid() OR is_shared = true AND EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = task_lists.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Users can manage their task lists" ON public.task_lists FOR ALL USING (owner_id = auth.uid());

-- Task policies
CREATE POLICY "Workspace members can view tasks" ON public.tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = tasks.workspace_id AND user_id = auth.uid()) OR created_by = auth.uid() OR assignee_id = auth.uid());
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Task creator or assignee can update" ON public.tasks FOR UPDATE
  USING (created_by = auth.uid() OR assignee_id = auth.uid());

-- Task comment policies
CREATE POLICY "Workspace members can view task comments" ON public.task_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tasks t JOIN public.workspace_members wm ON wm.workspace_id = t.workspace_id WHERE t.id = task_comments.task_id AND wm.user_id = auth.uid()));
CREATE POLICY "Users can create task comments" ON public.task_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own comments" ON public.task_comments FOR UPDATE USING (user_id = auth.uid());

-- Calendar policies
CREATE POLICY "Workspace members can view calendar events" ON public.calendar_events FOR SELECT
  USING (organizer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.event_attendees WHERE event_id = calendar_events.id AND user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = calendar_events.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Users can create calendar events" ON public.calendar_events FOR INSERT WITH CHECK (organizer_id = auth.uid());
CREATE POLICY "Organizer can update events" ON public.calendar_events FOR UPDATE USING (organizer_id = auth.uid());
CREATE POLICY "Organizer can delete events" ON public.calendar_events FOR DELETE USING (organizer_id = auth.uid());
CREATE POLICY "Users can manage their attendee status" ON public.event_attendees FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.calendar_events WHERE id = event_attendees.event_id AND organizer_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON public.tasks(list_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date) WHERE status != 'done';
CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace ON public.calendar_events(workspace_id, start_at);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON public.event_attendees(user_id);

-- Triggers
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_task_lists_updated_at BEFORE UPDATE ON public.task_lists FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
