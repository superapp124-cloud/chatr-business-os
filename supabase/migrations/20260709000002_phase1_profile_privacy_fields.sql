-- Migration to add extra profile fields and privacy settings to the profiles table
-- so DesktopProfile and DesktopPrivacy components can save to Supabase.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS occupation text,
ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{
  "last_seen": "contacts",
  "profile_photo": "everyone",
  "about": "contacts",
  "read_receipts": true,
  "location_sharing": false,
  "online_status": true
}'::jsonb;
