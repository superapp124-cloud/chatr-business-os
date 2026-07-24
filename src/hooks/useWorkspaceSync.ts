import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useWorkspaceSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    syncWorkspace();
  }, []);

  const syncWorkspace = async () => {
    try {
      setIsSyncing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSyncing(false);
        return;
      }

      // 1. Ensure user has a workspace
      let currentWorkspaceId = null;
      const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);

      if (wsError && wsError.code !== 'PGRST116') {
        console.error("Error fetching workspaces", wsError);
      }

      if (!workspaces || workspaces.length === 0) {
        // Create default workspace
        const { data: newWorkspace, error: createError } = await supabase
          .from('workspaces')
          .insert({
            owner_id: user.id,
            name: 'My Business Workspace',
            industry: 'General'
          })
          .select()
          .single();
          
        if (createError) {
          console.warn("[WorkspaceSync] Supabase RLS blocked creation, falling back to local workspace.");
          setWorkspaceId('local-fallback-workspace');
          setIsSyncing(false);
          return;
        }
        currentWorkspaceId = newWorkspace.id;
        
        // Add user as member
        await supabase.from('workspace_members').insert({
          workspace_id: currentWorkspaceId,
          user_id: user.id,
          role: 'owner'
        });

        // Seed initial tasks so the dashboard feels alive
        await supabase.from('workspace_tasks').insert([
          {
            workspace_id: currentWorkspaceId,
            title: 'Reply to Dr. Sharma',
            description: 'Patient inquiring about lab results.',
            task_type: 'reply',
            state: 'quick_win',
            status: 'pending',
            estimated_time_seconds: 60
          },
          {
            workspace_id: currentWorkspaceId,
            title: 'Quotation for TalentXcel',
            description: 'Drafted and ready for review.',
            task_type: 'quotation',
            state: 'prepared_by_ai',
            status: 'pending',
            estimated_time_seconds: 120
          },
          {
            workspace_id: currentWorkspaceId,
            title: 'Payment reminder for ABC Industries',
            description: 'Waiting 18 hours. Outstanding amount: ₹25,000.',
            task_type: 'payment',
            state: 'waiting_for_you',
            status: 'pending',
            estimated_time_seconds: 30
          },
          {
            workspace_id: currentWorkspaceId,
            title: 'Recruitment campaign',
            description: '87% complete. Waiting for candidate shortlist review.',
            task_type: 'document',
            state: 'in_progress',
            status: 'pending',
            estimated_time_seconds: 300
          }
        ]);
        
      } else {
        currentWorkspaceId = workspaces[0].id;
      }

      setWorkspaceId(currentWorkspaceId);

      // 2. Sync existing chat participants into workspace_customers
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
        
      if (participations && participations.length > 0) {
        const convIds = participations.map(p => p.conversation_id);
        
        // Find other users in these conversations
        const { data: others } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .in('conversation_id', convIds)
          .neq('user_id', user.id);
          
        if (others && others.length > 0) {
          const uniqueUserIds = Array.from(new Set(others.map(o => o.user_id)));
          
          // Check who is already a customer
          const { data: existingCustomers } = await supabase
            .from('workspace_customers')
            .select('profile_id')
            .eq('workspace_id', currentWorkspaceId);
            
          const existingIds = new Set(existingCustomers?.map(c => c.profile_id) || []);
          
          // Insert missing customers
          const newCustomers = uniqueUserIds
            .filter(id => !existingIds.has(id))
            .map(id => ({
              workspace_id: currentWorkspaceId,
              profile_id: id,
              segment: 'Lead'
            }));
            
          if (newCustomers.length > 0) {
            await supabase.from('workspace_customers').insert(newCustomers);
          }
        }
      }

    } catch (err) {
      console.error("Error syncing workspace:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, workspaceId };
};
