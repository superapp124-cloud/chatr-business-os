-- Create channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'subscriber' CHECK (role IN ('subscriber', 'admin', 'owner')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
-- Anyone can view channels
CREATE POLICY "Channels are viewable by everyone."
  ON public.channels FOR SELECT USING (true);

-- Only owners can create or update channels
CREATE POLICY "Owners can manage channels."
  ON public.channels FOR ALL USING (auth.uid() = owner_id);

-- Members can view channel members
CREATE POLICY "Members are viewable by everyone."
  ON public.channel_members FOR SELECT USING (true);

-- Users can join channels (insert subscriber)
CREATE POLICY "Users can join channels."
  ON public.channel_members FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'subscriber');

-- Owners/Admins can manage members
CREATE POLICY "Admins can manage members."
  ON public.channel_members FOR ALL USING (
    EXISTS (
      SELECT 1 FROM channel_members cm 
      WHERE cm.channel_id = channel_members.channel_id 
      AND cm.user_id = auth.uid() 
      AND cm.role IN ('admin', 'owner')
    )
  );

-- Users can leave channels
CREATE POLICY "Users can leave channels."
  ON public.channel_members FOR DELETE USING (auth.uid() = user_id);

-- Anyone can view messages
CREATE POLICY "Messages are viewable by everyone."
  ON public.channel_messages FOR SELECT USING (true);

-- Only admins/owners can post messages
CREATE POLICY "Admins can insert messages."
  ON public.channel_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM channel_members cm 
      WHERE cm.channel_id = channel_messages.channel_id 
      AND cm.user_id = auth.uid() 
      AND cm.role IN ('admin', 'owner')
    )
  );
