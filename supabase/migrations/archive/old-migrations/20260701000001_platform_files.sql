-- ============================================================
-- CHATR Platform: Files & Documents Domain
-- Migration: 20260701000001_platform_files.sql
-- ============================================================

-- File folders (hierarchical)
CREATE TABLE IF NOT EXISTS public.file_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.file_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- File objects
CREATE TABLE IF NOT EXISTS public.file_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.file_folders(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL, -- Supabase Storage path
  current_version INT DEFAULT 1,
  is_starred BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- File versions (version history)
CREATE TABLE IF NOT EXISTS public.file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.file_objects(id) ON DELETE CASCADE,
  version INT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- File shares
CREATE TABLE IF NOT EXISTS public.file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.file_objects(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email TEXT, -- for external shares
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document locks (for collaborative editing)
CREATE TABLE IF NOT EXISTS public.document_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.file_objects(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 minutes'),
  UNIQUE(file_id)
);

-- RLS
ALTER TABLE public.file_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_locks ENABLE ROW LEVEL SECURITY;

-- Policies: workspace members or file owner can access
CREATE POLICY "Workspace members can view files" ON public.file_objects
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = file_objects.workspace_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.file_shares WHERE file_id = file_objects.id AND shared_with_user_id = auth.uid())
  );
CREATE POLICY "Users can create files" ON public.file_objects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "File owners can update" ON public.file_objects FOR UPDATE USING (
  owner_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.file_shares WHERE file_id = file_objects.id AND shared_with_user_id = auth.uid() AND permission IN ('edit'))
);
CREATE POLICY "File owners can delete" ON public.file_objects FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Workspace members can view folders" ON public.file_folders FOR SELECT USING (
  owner_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = file_folders.workspace_id AND user_id = auth.uid())
);
CREATE POLICY "Users can manage their folders" ON public.file_folders FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Users can view versions of accessible files" ON public.file_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.file_objects fo WHERE fo.id = file_versions.file_id AND (fo.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = fo.workspace_id AND wm.user_id = auth.uid())))
);
CREATE POLICY "Users can create versions" ON public.file_versions FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can manage their shares" ON public.file_shares FOR ALL USING (created_by = auth.uid() OR shared_with_user_id = auth.uid());
CREATE POLICY "Users can manage their locks" ON public.document_locks FOR ALL USING (locked_by = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_file_objects_workspace ON public.file_objects(workspace_id, is_trashed);
CREATE INDEX IF NOT EXISTS idx_file_objects_folder ON public.file_objects(folder_id);
CREATE INDEX IF NOT EXISTS idx_file_objects_owner ON public.file_objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON public.file_versions(file_id, version DESC);

-- Triggers
CREATE TRIGGER update_file_objects_updated_at BEFORE UPDATE ON public.file_objects FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();
CREATE TRIGGER update_file_folders_updated_at BEFORE UPDATE ON public.file_folders FOR EACH ROW EXECUTE FUNCTION public.update_chatr_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_objects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_locks;
