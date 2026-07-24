-- Fix contacts table: make phone_number nullable and add unique on (user_id, contact_id)

-- Make phone_number optional (users added by profile search may not have a phone)
ALTER TABLE public.contacts ALTER COLUMN phone_number DROP NOT NULL;

-- Change uniqueness from (user_id, phone_number) to (user_id, contact_id) for profile-linked contacts
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'contacts_user_id_contact_phone_key' AND contype = 'u'
    ) THEN
        ALTER TABLE public.contacts DROP CONSTRAINT contacts_user_id_contact_phone_key;
    END IF;
    -- Also try the renamed version
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'contacts_user_id_phone_number_key' AND contype = 'u'
    ) THEN
        ALTER TABLE public.contacts DROP CONSTRAINT contacts_user_id_phone_number_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'contacts_user_id_contact_id_key' AND contype = 'u'
    ) THEN
        ALTER TABLE public.contacts ADD CONSTRAINT contacts_user_id_contact_id_key UNIQUE (user_id, contact_id);
    END IF;
END
$$;
