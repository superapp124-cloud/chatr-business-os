-- Phase 1 security hardening: audit events, conversation membership escalation fix,
-- and RLS performance indexes. This migration avoids UI-facing schema changes.

CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own security audit events" ON public.security_audit_events;
DROP POLICY IF EXISTS "Admins can view all security audit events" ON public.security_audit_events;

CREATE POLICY "Users can view own security audit events"
  ON public.security_audit_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security audit events"
  ON public.security_audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role::text IN ('admin', 'ceo')
    )
  );

CREATE INDEX IF NOT EXISTS idx_security_audit_events_user_created
  ON public.security_audit_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_events_type_created
  ON public.security_audit_events(event_type, created_at DESC);

-- The previous insert policy allowed user_id = auth.uid(), which let a user add
-- themselves to any known conversation id. Critical message/call policies depend
-- on conversation_participants, so membership creation must be controlled.
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Conversation creators and admins can add participants" ON public.conversation_participants;

CREATE POLICY "Conversation creators and admins can add participants"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = conversation_id
      AND conversations.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.conversation_participants existing_participant
      WHERE existing_participant.conversation_id = conversation_participants.conversation_id
      AND existing_participant.user_id = auth.uid()
      AND COALESCE(existing_participant.role, 'member') IN ('admin', 'creator')
    )
  );

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv_role_user
  ON public.conversation_participants(conversation_id, role, user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_created_by
  ON public.conversations(created_by);
