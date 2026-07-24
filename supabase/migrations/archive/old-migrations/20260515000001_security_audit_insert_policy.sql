-- Allow authenticated users to insert security audit events
-- This enables frontend-driven audit logging for governance
CREATE POLICY "Users can insert own security audit events"
  ON public.security_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
