import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessWorkflow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  nodes: any;
  edges: any;
  graph?: any;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export function useBusinessWorkflows() {
  const [workflows, setWorkflows] = useState<BusinessWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('business_workflows')
        .select('*')
        .eq('profile_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (err: any) {
      console.error('Error fetching workflows:', err);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const createWorkflow = async (name: string, description?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('business_workflows')
        .insert([{
          profile_id: user.id,
          name,
          description,
          status: 'draft',
          nodes: [],
          edges: []
        }])
        .select()
        .single();

      if (error) throw error;
      setWorkflows([data, ...workflows]);
      return data;
    } catch (err: any) {
      console.error('Error creating workflow:', err);
      toast.error('Failed to create workflow');
      return null;
    }
  };

  const updateWorkflow = async (id: string, updates: Partial<BusinessWorkflow>) => {
    try {
      const { error } = await supabase
        .from('business_workflows')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setWorkflows(workflows.map(w => w.id === id ? { ...w, ...updates, updated_at: new Date().toISOString() } as BusinessWorkflow : w));
      toast.success('Workflow updated');
      return true;
    } catch (err: any) {
      console.error('Error updating workflow:', err);
      toast.error('Failed to update workflow');
      return false;
    }
  };

  return {
    workflows,
    isLoading,
    refetch: fetchWorkflows,
    createWorkflow,
    updateWorkflow
  };
}
