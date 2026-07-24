-- Include sender identity aliases in message push trigger payloads so Android
-- native notifications can render the sender avatar.

CREATE OR REPLACE FUNCTION public.notify_message_push()
RETURNS TRIGGER AS $$
DECLARE
  receiver_ids UUID[];
  receiver_id UUID;
  sender_username TEXT;
  sender_avatar TEXT;
  message_preview TEXT;
BEGIN
  SELECT
    COALESCE(username, phone_number, 'Someone'),
    COALESCE(avatar_url, '')
  INTO sender_username, sender_avatar
  FROM profiles
  WHERE id = NEW.sender_id;

  message_preview := LEFT(COALESCE(NEW.content, 'New message'), 100);

  SELECT ARRAY_AGG(user_id) INTO receiver_ids
  FROM conversation_participants
  WHERE conversation_id = NEW.conversation_id
  AND user_id != NEW.sender_id;

  IF receiver_ids IS NOT NULL THEN
    FOREACH receiver_id IN ARRAY receiver_ids
    LOOP
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'userId', receiver_id,
          'title', sender_username,
          'body', message_preview,
          'notificationType', 'chat',
          'data', jsonb_build_object(
            'type', 'new_message',
            'senderId', NEW.sender_id,
            'sender_id', NEW.sender_id,
            'senderName', sender_username,
            'sender_name', sender_username,
            'senderAvatar', sender_avatar,
            'sender_avatar', sender_avatar,
            'avatar_url', sender_avatar,
            'conversationId', NEW.conversation_id,
            'conversation_id', NEW.conversation_id,
            'messageId', NEW.id,
            'message_id', NEW.id,
            'message', message_preview,
            'messageContent', message_preview,
            'click_action', '/chat/' || NEW.conversation_id,
            'route', '/chat/' || NEW.conversation_id
          )
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  participant RECORD;
  sender_profile RECORD;
  is_group_chat BOOLEAN;
BEGIN
  SELECT username, avatar_url INTO sender_profile
  FROM public.profiles
  WHERE id = NEW.sender_id;

  SELECT COUNT(*) > 2 INTO is_group_chat
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id;

  FOR participant IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.sender_id
  LOOP
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/fcm-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'message',
        'recipientId', participant.user_id,
        'senderId', NEW.sender_id,
        'senderName', COALESCE(sender_profile.username, 'Someone'),
        'senderAvatar', COALESCE(sender_profile.avatar_url, ''),
        'conversationId', NEW.conversation_id,
        'messageContent', LEFT(COALESCE(NEW.content, 'New message'), 100),
        'messageId', NEW.id::text,
        'isGroup', is_group_chat
      )::text
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
