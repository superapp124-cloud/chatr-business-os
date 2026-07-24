-- Add custom call ringtone column to conversation participants
ALTER TABLE conversation_participants 
ADD COLUMN IF NOT EXISTS custom_call_ringtone TEXT DEFAULT 'default';

COMMENT ON COLUMN conversation_participants.custom_call_ringtone IS 'Custom call ringtone ID for this specific chat (e.g. synth_wave, alien_siren, minimal_pop)';
