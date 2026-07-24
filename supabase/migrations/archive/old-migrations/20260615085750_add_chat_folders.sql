-- Migration: Add Chat Folders and Unlimited Pinning

-- 1. Add is_pinned to conversation_participants to support unlimited pinning per user
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_participants' AND column_name = 'is_pinned') THEN
        ALTER TABLE public.conversation_participants ADD COLUMN is_pinned boolean DEFAULT false NOT NULL;
    END IF;
END $$;

-- 2. Create chat_folders table
CREATE TABLE IF NOT EXISTS public.chat_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for chat_folders
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat folders" ON public.chat_folders;
CREATE POLICY "Users can manage their own chat folders"
    ON public.chat_folders
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Create chat_folder_items table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.chat_folder_items (
    folder_id UUID NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (folder_id, conversation_id)
);

-- RLS for chat_folder_items
ALTER TABLE public.chat_folder_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat folder items" ON public.chat_folder_items;
CREATE POLICY "Users can manage their own chat folder items"
    ON public.chat_folder_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_folders 
            WHERE chat_folders.id = chat_folder_items.folder_id 
            AND chat_folders.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_folders 
            WHERE chat_folders.id = chat_folder_items.folder_id 
            AND chat_folders.user_id = auth.uid()
        )
    );

-- Add updated_at trigger for chat_folders
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_chat_folders_updated_at ON public.chat_folders;
CREATE TRIGGER update_chat_folders_updated_at
    BEFORE UPDATE ON public.chat_folders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
