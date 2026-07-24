-- Add missing legacy columns back to messages table to prevent 400 errors in legacy queries
-- These columns are queried by various frontend components that haven't been updated
-- to the new unified schema yet.

-- 1. message_type (we can just add it as a normal column or generated, but let's just add it as text)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
        -- Safest is just a regular column so inserts don't fail if they provide it
        ALTER TABLE public.messages ADD COLUMN message_type TEXT DEFAULT 'text';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') THEN
        ALTER TABLE public.messages ADD COLUMN media_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_attachments') THEN
        ALTER TABLE public.messages ADD COLUMN media_attachments JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'read_at') THEN
        ALTER TABLE public.messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status') THEN
        ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'sent';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_starred') THEN
        ALTER TABLE public.messages ADD COLUMN is_starred BOOLEAN DEFAULT false;
    END IF;
END
$$;
