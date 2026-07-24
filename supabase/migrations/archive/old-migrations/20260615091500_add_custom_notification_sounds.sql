-- Phase 5: Custom Notification Sounds

-- Add custom notification sound column to conversation participants
ALTER TABLE conversation_participants 
ADD COLUMN IF NOT EXISTS custom_notification_sound TEXT DEFAULT 'default';

-- Add custom notification sound globally to profiles as a fallback
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS default_notification_sound TEXT DEFAULT 'default';

COMMENT ON COLUMN conversation_participants.custom_notification_sound IS 'Custom notification sound ID for this specific chat (e.g. glass_chime, minimal_pop, amoled_ping, synth_wave)';
COMMENT ON COLUMN profiles.default_notification_sound IS 'Global default notification sound ID for the user';
