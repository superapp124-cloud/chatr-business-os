-- ==============================================================================
-- PHASE 1 - PART 4: CORE MESSAGING SCHEMA PATCH
-- Fix missing table-level GRANTs for contacts, user_devices, and notification_preferences
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
