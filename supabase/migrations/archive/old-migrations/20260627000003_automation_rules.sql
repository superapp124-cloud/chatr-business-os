-- Migration to create the automation_rules table for CHATR Automation Engine

create table if not exists public.automation_rules (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    trigger_type text not null, -- 'message_received', 'call_missed', 'event_scheduled'
    conditions jsonb not null default '[]'::jsonb, -- Array of condition objects
    action_type text not null, -- 'auto_reply', 'archive', 'forward', 'save_to_cloud'
    action_payload jsonb not null default '{}'::jsonb, -- Action configuration
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.automation_rules enable row level security;

-- Policies
create policy "Users can view their own automation rules"
    on public.automation_rules for select
    using (auth.uid() = user_id);

create policy "Users can insert their own automation rules"
    on public.automation_rules for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own automation rules"
    on public.automation_rules for update
    using (auth.uid() = user_id);

create policy "Users can delete their own automation rules"
    on public.automation_rules for delete
    using (auth.uid() = user_id);

-- Updated_at trigger
create trigger set_automation_rules_updated_at
before update on public.automation_rules
for each row
execute function public.handle_updated_at();

-- Index for fast lookup
create index idx_automation_rules_user_id on public.automation_rules(user_id);
