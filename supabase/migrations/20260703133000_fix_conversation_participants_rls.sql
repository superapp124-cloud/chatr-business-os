-- Fix infinite recursion on conversation_participants

-- 1. Create a security definer function to check if the user is a participant
-- Security Definer bypasses RLS, so it won't recursively trigger policies!
CREATE OR REPLACE FUNCTION public.is_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_participants 
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

-- 2. Fix conversation_participants policy
DROP POLICY IF EXISTS "Participants can view other participants" ON public.conversation_participants;
CREATE POLICY "Participants can view other participants" 
ON public.conversation_participants 
FOR SELECT 
USING ( public.is_participant(conversation_id) );

-- 3. Fix conversations policy
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" 
ON public.conversations 
FOR SELECT 
USING ( public.is_participant(id) );

-- 4. Fix messages policy
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" 
ON public.messages 
FOR SELECT 
USING ( public.is_participant(conversation_id) );

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK ( public.is_participant(conversation_id) );

-- 5. Fix calls policy
DROP POLICY IF EXISTS "Participants can view calls" ON public.calls;
CREATE POLICY "Participants can view calls" 
ON public.calls 
FOR SELECT 
USING ( public.is_participant(conversation_id) );
