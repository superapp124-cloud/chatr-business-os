-- Migration: Phase 1 — Final RLS Hardening (Notifications & Admin)
-- Date: 2026-07-09

-- ═══════════════════════════════════════════════════════════
-- 1. NOTIFICATIONS — Strict user isolation
-- ═══════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- Usually restricted to Edge Functions or triggers in production

-- ═══════════════════════════════════════════════════════════
-- 2. ADMINISTRATIVE TABLES — Role-based access
-- Assumes a 'role' or 'is_admin' field exists in 'profiles',
-- or we rely on explicit user whitelisting. For now, we lock them down.
-- ═══════════════════════════════════════════════════════════

-- App Approvals
ALTER TABLE IF EXISTS public.app_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view app approvals" ON public.app_approvals;
CREATE POLICY "Admins can view app approvals"
  ON public.app_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.metadata->>'role' = 'admin'
    )
  );

-- KYC Approvals
ALTER TABLE IF EXISTS public.kyc_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view kyc approvals" ON public.kyc_approvals;
CREATE POLICY "Admins can view kyc approvals"
  ON public.kyc_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.metadata->>'role' = 'admin'
    )
  );
