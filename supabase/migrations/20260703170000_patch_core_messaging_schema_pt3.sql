-- ==============================================================================
-- PHASE 1 - PART 3: CORE MESSAGING SCHEMA PATCH
-- Fix contacts table columns and foreign key to public.users so frontend can join
-- with the profiles view.
-- ==============================================================================

-- 1. Rename columns to match frontend expectations
ALTER TABLE public.contacts RENAME COLUMN contact_phone TO phone_number;
ALTER TABLE public.contacts RENAME COLUMN contact_name TO name;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Drop old constraint on auth.users if it exists
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints
    WHERE table_name = 'contacts' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%contact_user_id%';
      
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.contacts DROP CONSTRAINT ' || fk_name;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if constraint doesn't exist
END
$$;

-- 3. Rename contact_user_id to contact_id
ALTER TABLE public.contacts RENAME COLUMN contact_user_id TO contact_id;

-- 4. Add the correct foreign key constraint to public.users so PostgREST can resolve the relation to public.profiles view
ALTER TABLE public.contacts ADD CONSTRAINT contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.users(id) ON DELETE CASCADE;
