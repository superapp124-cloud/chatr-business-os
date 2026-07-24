-- Migration: 20260626130000_remediate_username_pii_leak.sql
-- Description: Safely sanitizes existing profiles where a phone number leaked into the username field.

BEGIN;

-- 1. Create an audit table and snapshot affected rows BEFORE making changes.
-- This allows recovery if the regex over-matches or misses something.
CREATE TABLE public._username_remediation_audit AS
SELECT 
  id, 
  username, 
  phone_number, 
  now() as remediated_at
FROM public.profiles
WHERE username ~ '^\+?[0-9]{7,15}$';

-- 2. Execute the data overwrite.
-- Use an 8-character UUID slice to match PhoneAuth.tsx and avoid UI length constraints.
UPDATE public.profiles
SET username = 'User_' || substring(id::text from 1 for 8)
WHERE username ~ '^\+?[0-9]{7,15}$';

COMMIT;
