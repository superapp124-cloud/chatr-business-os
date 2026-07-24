import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user payload from the auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { action } = await req.json()

    if (action === 'initialize') {
      await initializeWorkspace(supabaseClient, user.id, user.email || 'Unknown')
      return new Response(JSON.stringify({ success: true, message: 'Workspace initialized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } else if (action === 'health_check') {
      await checkWorkspaceHealth(supabaseClient, user.id)
      return new Response(JSON.stringify({ success: true, message: 'Workspace health verified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

// ============================================================================
// PLATFORM BOOTSTRAP: RUNS ONCE PER USER
// ============================================================================
async function initializeWorkspace(supabase: any, userId: string, email: string) {
  // 1. Ensure Actor exists for user
  const { data: existingActor } = await supabase.from('actors').select('id').eq('id', userId).single();
  if (!existingActor) {
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).single();
    await supabase.from('actors').insert({
      id: userId,
      type: 'USER',
      display_name: profile?.username || email.split('@')[0],
      status: 'online'
    }).select().single();
  }

  // 2. Create Organization
  const { data: org, error: orgErr } = await supabase.from('organizations').insert({
    name: 'Personal Workspace',
    type: 'personal'
  }).select().single();
  
  if (orgErr) throw orgErr;

  // 3. Create Workspace
  const { data: workspace, error: wsErr } = await supabase.from('workspaces').insert({
    owner_id: userId,
    organization_id: org.id,
    name: 'Personal',
    workspace_version: 1
  }).select().single();

  if (wsErr) throw wsErr;

  // 4. Create Workspace Member
  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner'
  });

  // 5. Setup Default Channels
  const defaultChannels = [
    { name: 'General', type: 'channel' },
    { name: 'Announcements', type: 'channel' },
    { name: 'Workspace Feed', type: 'channel' },
    { name: 'AI Assistant', type: 'dm' } // AI dm
  ];

  for (const ch of defaultChannels) {
    const { data: room, error: roomErr } = await supabase.from('conversations').insert({
      name: ch.name,
      type: ch.type,
      workspace_id: workspace.id,
      created_by: userId
    }).select().single();

    if (roomErr) continue;

    // Add user to channel
    await supabase.from('conversation_participants').insert({
      conversation_id: room.id,
      user_id: userId,
      actor_id: userId,
      role: ch.name === 'Announcements' ? 'admin' : 'member'
    });

    // If it's General or AI Assistant, also add CHATR AI as participant
    if (ch.name === 'General' || ch.name === 'AI Assistant') {
      await supabase.from('conversation_participants').insert({
        conversation_id: room.id,
        user_id: userId, // system technically doesn't need user_id, but schema might enforce it
        actor_id: '11111111-1111-1111-1111-111111111111',
        role: 'member'
      });
    }

    // 6. Generate Contextual Welcome Message for AI Assistant channel
    if (ch.name === 'AI Assistant') {
      await supabase.from('messages').insert({
        conversation_id: room.id,
        actor_id: '11111111-1111-1111-1111-111111111111',
        sender_id: '11111111-1111-1111-1111-111111111111', // Fallback for legacy
        content: `Welcome to CHATR. I've finished setting up your workspace.\n\nAvailable today:\n✓ AI Assistant\n✓ Secure Chat\n✓ Personal Notes\n✓ Files\n\nNext step:\nInvite your first teammate`
      });
    }
  }

  // 7. Publish WorkspaceCreated Event
  await supabase.from('mobile_action_queue').insert({
    action_type: 'WorkspaceCreated',
    payload: { workspace_id: workspace.id, user_id: userId }
  });
}

// ============================================================================
// PLATFORM HEALTH CHECK: RUNS ON EVERY LOGIN
// ============================================================================
async function checkWorkspaceHealth(supabase: any, userId: string) {
  // Find user's active workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!member) return; // Cannot check health without workspace

  const workspaceId = member.workspace_id;

  // 1. Check schema version
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('workspace_version')
    .eq('id', workspaceId)
    .single();

  // Here we would run upgrades if workspace.workspace_version < CURRENT_VERSION
  
  // 2. Check for missing core channels
  const requiredChannels = ['General', 'Announcements', 'Workspace Feed', 'AI Assistant'];
  const { data: existingRooms } = await supabase
    .from('conversations')
    .select('name')
    .eq('workspace_id', workspaceId)
    .in('name', requiredChannels);

  const existingNames = new Set(existingRooms?.map((r: any) => r.name) || []);
  const missing = requiredChannels.filter(c => !existingNames.has(c));

  for (const name of missing) {
    const { data: newRoom } = await supabase.from('conversations').insert({
      name: name,
      type: name === 'AI Assistant' ? 'dm' : 'channel',
      workspace_id: workspaceId,
      created_by: userId
    }).select().single();

    if (newRoom) {
      await supabase.from('conversation_participants').insert({
        conversation_id: newRoom.id,
        user_id: userId,
        actor_id: userId,
        role: name === 'Announcements' ? 'admin' : 'member'
      });
    }
  }

  // 3. Ensure AI Actor exists and is online
  await supabase.from('actors').upsert({
    id: '11111111-1111-1111-1111-111111111111',
    type: 'AI',
    display_name: 'CHATR AI',
    status: 'online'
  });
}
