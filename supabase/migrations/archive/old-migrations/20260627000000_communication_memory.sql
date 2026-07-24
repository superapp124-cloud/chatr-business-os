-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the unified communication_memory table
create table if not exists public.communication_memory (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) not null,
    conversation_id uuid references public.conversations(id),
    memory_type text not null, -- 'message', 'voice_note', 'document', 'image', 'call_summary'
    content text not null,
    metadata jsonb not null default '{}'::jsonb,
    embedding vector(768), -- Gemini text-embedding-004 uses 768 dimensions
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable RLS
alter table public.communication_memory enable row level security;

-- Policies for communication_memory
create policy "Users can view their own memory"
    on public.communication_memory for select
    using (auth.uid() = user_id);

create policy "Users can insert their own memory"
    on public.communication_memory for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own memory"
    on public.communication_memory for update
    using (auth.uid() = user_id);

create policy "Users can delete their own memory"
    on public.communication_memory for delete
    using (auth.uid() = user_id);

-- Create an HNSW index for fast similarity search
create index on public.communication_memory 
using hnsw (embedding vector_cosine_ops);

-- Create an RPC function for Hybrid Search Memory
create or replace function hybrid_search_memory(
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    p_user_id uuid,
    filter_type text default null
)
returns table (
    id uuid,
    conversation_id uuid,
    memory_type text,
    content text,
    metadata jsonb,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        cm.id,
        cm.conversation_id,
        cm.memory_type,
        cm.content,
        cm.metadata,
        1 - (cm.embedding <=> query_embedding) as similarity
    from communication_memory cm
    where cm.user_id = p_user_id
    and (filter_type is null or cm.memory_type = filter_type)
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
    order by cm.embedding <=> query_embedding
    limit match_count;
end;
$$;
