-- Keep web signups as first-class public.users records while legacy UI
-- still reads the profiles surface.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_handle TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contacts_synced BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_contact_sync TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_search TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_primary_handle_key
  ON public.users(primary_handle)
  WHERE primary_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_phone_search ON public.users(phone_search);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

CREATE OR REPLACE FUNCTION public.set_users_phone_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone_search := regexp_replace(COALESCE(NEW.phone_number, ''), '[^0-9]', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_phone_search ON public.users;
CREATE TRIGGER set_users_phone_search
  BEFORE INSERT OR UPDATE OF phone_number ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_users_phone_search();

UPDATE public.users
SET phone_search = regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL
  AND (phone_search IS NULL OR phone_search = '');

GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.users
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users';
  END IF;
END $$;
