-- Migration to create the unified Universal Timeline RPC

create type public.timeline_item as (
  id uuid,
  timeline_type text, -- 'message', 'call', 'payment'
  created_at timestamptz,
  sender_id uuid, -- The person who initiated the event
  payload jsonb -- The raw record data
);

create or replace function public.get_universal_timeline(
  p_conversation_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.timeline_item
language plpgsql
security definer
as $$
begin
  -- Ensure user is part of the conversation
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
    and user_id = auth.uid()
  ) then
    raise exception 'Unauthorized';
  end if;

  return query
  select * from (
    -- 1. MESSAGES
    select 
      m.id,
      'message'::text as timeline_type,
      m.created_at,
      m.sender_id,
      row_to_json(m)::jsonb as payload
    from public.messages m
    where m.conversation_id = p_conversation_id
    
    union all
    
    -- 2. CALLS
    select 
      c.id,
      'call'::text as timeline_type,
      c.started_at as created_at,
      c.caller_id as sender_id,
      row_to_json(c)::jsonb as payload
    from public.calls c
    where c.conversation_id = p_conversation_id

    -- Future expansion: Union payments, calendar events, etc.
    -- Assuming they are tied to conversation_id or participant IDs
    
  ) as timeline
  order by created_at desc
  limit p_limit
  offset p_offset;
end;
$$;
