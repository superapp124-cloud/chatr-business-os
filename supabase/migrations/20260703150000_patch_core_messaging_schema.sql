-- ==============================================================================
-- PHASE 1: CORE MESSAGING SCHEMA PATCH
-- This migration brings the old database up to parity with the core messaging 
-- requirements of the current frontend, without adding unnecessary bloat.
-- ==============================================================================

-- 1. FIX PROFILES RLS & COLUMNS
-- Ensure default_notification_sound exists on users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_notification_sound TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Ensure underlying table policies are robust
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Public active users are viewable by everyone'
    ) THEN
        CREATE POLICY "Public active users are viewable by everyone" ON public.users FOR SELECT USING (true);
    END IF;
END
$$;

-- Drop and recreate the view to ensure it captures all new columns
DROP VIEW IF EXISTS public.profiles;
CREATE VIEW public.profiles WITH (security_invoker = true) AS SELECT * FROM public.users;

-- Explicitly GRANT permissions to the view so PostgREST allows the operations
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 2. UPDATE CONVERSATIONS SCHEMA
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS group_icon_url TEXT,
ADD COLUMN IF NOT EXISTS is_community BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS community_description TEXT;

-- 3. CREATE CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT,
  is_registered BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, contact_phone)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'contacts' AND policyname = 'Users can manage their own contacts'
    ) THEN
        CREATE POLICY "Users can manage their own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 4. CREATE USER_DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'web',
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, device_fingerprint)
);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_devices' AND policyname = 'Users can view their own devices'
    ) THEN
        CREATE POLICY "Users can view their own devices" ON public.user_devices FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert their own devices" ON public.user_devices FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update their own devices" ON public.user_devices FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete their own devices" ON public.user_devices FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 5. CREATE NOTIFICATION_PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    chat_notifications BOOLEAN DEFAULT true,
    group_notifications BOOLEAN DEFAULT true,
    call_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_preferences' AND policyname = 'Users can manage own preferences'
    ) THEN
        CREATE POLICY "Users can manage own preferences" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 6. RESTORE CORE RPCs
-- create_direct_conversation
CREATE OR REPLACE FUNCTION public.create_direct_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_conv_id uuid;
  existing_conv_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- Check if conversation already exists
  SELECT c.id INTO existing_conv_id
  FROM conversations c
  JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
  JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
  WHERE c.type = 'direct'
    AND cp1.user_id = current_user_id
    AND cp2.user_id = other_user_id
  LIMIT 1;

  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (type, is_group)
  VALUES ('direct', false)
  RETURNING id INTO new_conv_id;

  -- Add participants
  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES 
    (new_conv_id, current_user_id, 'member'),
    (new_conv_id, other_user_id, 'member');
  
  RETURN new_conv_id;
END;
$function$;

-- get_user_conversations_optimized
CREATE OR REPLACE FUNCTION public.get_user_conversations_optimized(p_user_id uuid)
RETURNS TABLE(id uuid, group_name text, group_icon_url text, is_group boolean, is_community boolean, community_description text, lastmessage text, lastmessagetime timestamp with time zone, otheruser jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH user_convs AS (
    SELECT cp.conversation_id
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id
    LIMIT 50
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at
    FROM messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM user_convs)
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  other_users AS (
    SELECT DISTINCT ON (cp.conversation_id)
      cp.conversation_id,
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'is_online', p.is_online
      ) as user_data
    FROM conversation_participants cp
    JOIN profiles p ON p.id = cp.user_id
    JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.conversation_id IN (SELECT conversation_id FROM user_convs)
      AND cp.user_id != p_user_id
      AND c.is_group = false
  )
  SELECT 
    c.id,
    c.group_name,
    c.group_icon_url,
    c.is_group,
    c.is_community,
    c.community_description,
    lm.content as lastmessage,
    lm.created_at as lastmessagetime,
    ou.user_data as otheruser
  FROM conversations c
  JOIN user_convs uc ON uc.conversation_id = c.id
  LEFT JOIN last_messages lm ON lm.conversation_id = c.id
  LEFT JOIN other_users ou ON ou.conversation_id = c.id
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$function$;
