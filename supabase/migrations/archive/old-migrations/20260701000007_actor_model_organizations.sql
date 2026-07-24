-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'personal' CHECK (type IN ('personal', 'enterprise', 'business')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alter Workspaces to belong to an organization and add versioning
ALTER TABLE public.workspaces 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS workspace_version INT DEFAULT 1;

-- 2. Actors Model
CREATE TABLE IF NOT EXISTS public.actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'USER' CHECK (type IN ('USER', 'AI', 'SYSTEM', 'BOT', 'SERVICE', 'INTEGRATION')),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'online',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed System Actors (using deterministic UUIDs for safe reference)
INSERT INTO public.actors (id, type, display_name, avatar_url, status)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'SYSTEM', 'SYSTEM', NULL, 'online'),
  ('11111111-1111-1111-1111-111111111111', 'AI', 'CHATR AI', NULL, 'online')
ON CONFLICT (id) DO NOTHING;

-- Migrate existing profiles to actors
-- Ensure every profile has a corresponding actor record with the SAME ID (since profile.id == auth.users.id)
INSERT INTO public.actors (id, type, display_name, avatar_url, status)
SELECT 
  id, 
  'USER', 
  username, 
  avatar_url, 
  status
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Trigger to sync future profiles to actors
CREATE OR REPLACE FUNCTION public.sync_profile_to_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.actors (id, type, display_name, avatar_url, status)
  VALUES (NEW.id, 'USER', NEW.username, NEW.avatar_url, NEW.status)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    status = EXCLUDED.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_actor ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_actor
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_actor();

-- 3. Update Messages Table (Rename sender_id to actor_id)
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.actors(id) ON DELETE CASCADE;

-- Backfill actor_id with sender_id (since they map 1:1 for existing user messages)
UPDATE public.messages SET actor_id = sender_id WHERE actor_id IS NULL AND sender_id IS NOT NULL;

-- 4. Update Conversation Participants
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.actors(id) ON DELETE CASCADE;

UPDATE public.conversation_participants SET actor_id = user_id WHERE actor_id IS NULL AND user_id IS NOT NULL;

-- 5. Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Actors are viewable by everyone" ON public.actors FOR SELECT USING (true);
CREATE POLICY "Organizations are viewable by everyone" ON public.organizations FOR SELECT USING (true);
