-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Semantic Memory Table
CREATE TABLE IF NOT EXISTS public.semantic_memory (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'chat', 'doc', 'code', 'rule', 'log'
    content text NOT NULL,
    embedding vector(1536), -- Standard OpenAI/Local embedding size
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS semantic_memory_embedding_idx 
ON public.semantic_memory 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.semantic_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own semantic memory"
    ON public.semantic_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own semantic memory"
    ON public.semantic_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own semantic memory"
    ON public.semantic_memory FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own semantic memory"
    ON public.semantic_memory FOR DELETE
    USING (auth.uid() = user_id);

-- Semantic Search Function
CREATE OR REPLACE FUNCTION match_semantic_memory (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  type text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    semantic_memory.id,
    semantic_memory.type,
    semantic_memory.content,
    semantic_memory.metadata,
    1 - (semantic_memory.embedding <=> query_embedding) AS similarity
  FROM semantic_memory
  WHERE semantic_memory.user_id = p_user_id
    AND (p_type IS NULL OR semantic_memory.type = p_type)
    AND 1 - (semantic_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY semantic_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;
