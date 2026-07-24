-- Migration: Core Foundation v1 - Part 3
-- Description: Enhanced attachments metadata and Private Storage Configuration.
-- Includes: Expanding attachments table and configuring the chat_attachments private bucket.

-- 1. Enhanced Attachments
ALTER TABLE public.attachments
    ADD COLUMN IF NOT EXISTS thumbnail_url text,
    ADD COLUMN IF NOT EXISTS mime_type text,
    ADD COLUMN IF NOT EXISTS checksum text,
    ADD COLUMN IF NOT EXISTS width integer,
    ADD COLUMN IF NOT EXISTS height integer,
    ADD COLUMN IF NOT EXISTS duration integer, -- For audio/video in seconds
    ADD COLUMN IF NOT EXISTS storage_provider text DEFAULT 'supabase',
    ADD COLUMN IF NOT EXISTS storage_path text;

-- 2. Private Storage Configuration (chat_attachments)
-- Insert the bucket configuration directly into Supabase's storage schema
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat_attachments',
    'chat_attachments',
    false, -- Explicitly private, enforcing Signed URLs for access
    52428800, -- 50MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'video/mp4', 'text/plain']::text[]
) ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'video/mp4', 'text/plain']::text[];

-- Set up Row Level Security (RLS) for the storage objects
-- Note: 'storage.objects' already has RLS enabled by Supabase by default, we just add our policies.

-- Policy: Allow authenticated users to upload files to chat_attachments
CREATE POLICY "Authenticated users can upload attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'chat_attachments' AND 
        auth.role() = 'authenticated'
    );

-- Policy: Allow authenticated users to read objects in chat_attachments
-- Note: Even with this policy, since the bucket is private, frontend usually accesses via createSignedUrl.
-- But we still allow SELECT for the API via this policy.
CREATE POLICY "Authenticated users can view attachments"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'chat_attachments' AND 
        auth.role() = 'authenticated'
    );

-- Policy: Allow authenticated users to update/delete their own attachments
CREATE POLICY "Users can update their own attachments"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'chat_attachments' AND 
        auth.uid() = owner
    );

CREATE POLICY "Users can delete their own attachments"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'chat_attachments' AND 
        auth.uid() = owner
    );
