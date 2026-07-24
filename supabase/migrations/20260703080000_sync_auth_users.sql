-- Create a trigger to automatically sync auth.users to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, phone_number, email, created_at, updated_at)
  VALUES (
    NEW.id,
    'user_' || substr(NEW.id::text, 1, 8),
    NEW.phone,
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number),
    email = COALESCE(EXCLUDED.email, public.users.email),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Also backfill any existing users that might be missing from public.users
INSERT INTO public.users (id, username, phone_number, email, created_at, updated_at)
SELECT 
  id, 
  'user_' || substr(id::text, 1, 8),
  phone,
  email,
  NOW(),
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number),
  email = COALESCE(EXCLUDED.email, public.users.email),
  updated_at = NOW();
