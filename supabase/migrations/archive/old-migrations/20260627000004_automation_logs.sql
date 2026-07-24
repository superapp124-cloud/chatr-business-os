-- Migration to create the automation_logs table for CHATR Automation Engine

create table if not exists public.automation_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    rule_id uuid not null references public.automation_rules(id) on delete cascade,
    trigger_type text not null,
    action_taken text not null,
    time_saved_seconds integer not null default 0,
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.automation_logs enable row level security;

-- Policies
create policy "Users can view their own automation logs"
    on public.automation_logs for select
    using (auth.uid() = user_id);

create policy "Users can insert their own automation logs"
    on public.automation_logs for insert
    with check (auth.uid() = user_id);

-- Index for fast lookup
create index idx_automation_logs_user_id on public.automation_logs(user_id);
create index idx_automation_logs_rule_id on public.automation_logs(rule_id);
create index idx_automation_logs_created_at on public.automation_logs(created_at);

-- RPC for UI Metrics
create or replace function public.get_automation_metrics(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_active_count integer;
    v_runs_today integer;
    v_time_saved_seconds integer;
begin
    -- Check permissions
    if auth.uid() != p_user_id then
        raise exception 'Unauthorized';
    end if;

    -- Get active rules count
    select count(*) into v_active_count
    from public.automation_rules
    where user_id = p_user_id and is_active = true;

    -- Get runs today (since start of current day in UTC, or just last 24h for simplicity)
    select count(*) into v_runs_today
    from public.automation_logs
    where user_id = p_user_id and created_at >= now() - interval '24 hours';

    -- Get total time saved
    select coalesce(sum(time_saved_seconds), 0) into v_time_saved_seconds
    from public.automation_logs
    where user_id = p_user_id;

    return json_build_object(
        'activeCount', v_active_count,
        'runsToday', v_runs_today,
        'timeSavedSeconds', v_time_saved_seconds
    );
end;
$$;
