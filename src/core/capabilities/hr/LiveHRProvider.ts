import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { supabase } from '@/integrations/supabase/client';
import { TraceContext } from '@/core/runtime/TraceContext';

export const LiveHRProvider = WorkflowSDK.createProvider(
  'testbed-hr',
  'Live HR Testbed Provider',
  'hr',
  'ExecutionProvider',
  {
    search: async (query: any, trace?: TraceContext) => {
      trace?.publish('HR_SEARCH_STARTED', { query });
      
      const { data, error } = await supabase
        .from('testbed_hr_candidates')
        .select('*')
        .ilike('role', `%${query}%`);
        
      if (error) {
        trace?.publish('HR_SEARCH_FAILED', { error: error.message });
        throw error;
      }
      
      trace?.publish('HR_SEARCH_COMPLETED', { count: data.length });
      return data;
    },
    create: async (payload: any, trace?: TraceContext) => {
      trace?.publish('HR_CANDIDATE_CREATION_STARTED', { payload });
      
      const { data, error } = await supabase
        .from('testbed_hr_candidates')
        .insert({
          name: payload.name,
          role: payload.role,
          status: payload.status || 'sourced',
          resume_url: payload.resume_url
        })
        .select()
        .single();
        
      if (error) {
        trace?.publish('HR_CANDIDATE_CREATION_FAILED', { error: error.message });
        throw error;
      }
      
      trace?.publish('HR_CANDIDATE_CREATED', { candidate_id: data.id });
      return { id: data.id, status: data.status };
    }
  }
);
