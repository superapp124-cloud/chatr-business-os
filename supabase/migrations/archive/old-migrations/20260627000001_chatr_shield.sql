-- Create the message_security_scans table for CHATR Shield
create table if not exists public.message_security_scans (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.messages(id) on delete cascade not null,
    overall_score integer not null default 0,
    overall_level text not null default 'safe', -- 'safe', 'suspicious', 'dangerous'
    detections jsonb not null default '{}'::jsonb,
    explanation jsonb,
    recommended_action text,
    scanned_at timestamptz default now()
);

-- Enable RLS
alter table public.message_security_scans enable row level security;

-- Policies
create policy "Users can view security scans for their messages"
    on public.message_security_scans for select
    using (
        exists (
            select 1 from public.messages
            where messages.id = message_security_scans.message_id
            and (
                messages.sender_id = auth.uid() or 
                exists (
                    select 1 from public.conversations c 
                    where c.id = messages.conversation_id 
                    and (c.user_id = auth.uid() or c.other_user_id = auth.uid())
                )
            )
        )
    );

create policy "Service role can insert security scans"
    on public.message_security_scans for insert
    with check (true); -- Usually restricted to service role in actual deployment

create policy "Users can update their scans to provide feedback"
    on public.message_security_scans for update
    using (
        exists (
            select 1 from public.messages
            where messages.id = message_security_scans.message_id
            and (
                messages.sender_id = auth.uid() or 
                exists (
                    select 1 from public.conversations c 
                    where c.id = messages.conversation_id 
                    and (c.user_id = auth.uid() or c.other_user_id = auth.uid())
                )
            )
        )
    );

-- Index for fast lookup by message
create index idx_message_security_scans_message_id on public.message_security_scans(message_id);
