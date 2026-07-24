-- ============================================================
-- CHATR Platform: Collaboration Domain
-- Migration: 20260701000004_platform_collaboration.sql
-- ============================================================

-- Universal Comments (attaches to any entity type)
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'task', 'file', 'meeting', 'message'
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE, -- threaded replies
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  reactions JSONB DEFAULT '{}'::jsonb, -- { "👍": ["user_id1", "user_id2"] }
  mentions JSONB DEFAULT '[]'::jsonb, -- [user_id, ...]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'mention', 'task_assigned', 'meeting_reminder', 'file_shared', 'comment', 'reaction'
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT, -- deep link: '/desktop/chat?room=xxx'
  entity_type TEXT, -- source entity type
  entity_id UUID,   -- source entity id
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- who triggered this
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Presence Sessions
CREATE TABLE IF NOT EXISTS public.presence_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  current_page TEXT, -- '/desktop/chat', '/desktop/workspace'
  entity_type TEXT,  -- what they're viewing: 'task', 'file', 'room'
  entity_id UUID,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  session_started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id) -- one presence record per user
);

-- RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_sessions ENABLE ROW LEVEL SECURITY;

-- Comment policies
CREATE POLICY "Workspace members can view comments" ON public.comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = comments.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Workspace members can create comments" ON public.comments FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = comments.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Comment author can update their comments" ON public.comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Comment author can delete their comments" ON public.comments FOR DELETE USING (user_id = auth.uid());

-- Notification policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true); -- service role only in practice
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Presence policies
CREATE POLICY "Workspace members can view presence" ON public.presence_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = presence_sessions.workspace_id AND user_id = auth.uid()));
CREATE POLICY "Users manage their own presence" ON public.presence_sessions FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_presence_workspace ON public.presence_sessions(workspace_id, status);

-- Triggers
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();

-- Notification helper function: create notification and return it
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notification public.notifications;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, action_url, entity_type, entity_id, actor_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_action_url, p_entity_type, p_entity_id, p_actor_id)
  RETURNING * INTO v_notification;
  RETURN v_notification;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence_sessions;
