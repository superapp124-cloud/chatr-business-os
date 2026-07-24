import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessCallLog {
  id: string;
  profile_id: string;
  caller_number: string;
  receiver_number: string;
  direction: 'inbound' | 'outbound';
  duration_seconds: number;
  status: 'missed' | 'completed' | 'voicemail' | 'abandoned';
  routing_workflow_id: string | null;
  recording_url: string | null;
  transcription: string | null;
  created_at: string;
}

export function useBusinessPhone() {
  const [callLogs, setCallLogs] = useState<BusinessCallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('business_call_logs')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Get latest 50 for dashboard

      if (error) throw error;
      setCallLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching call logs:', err);
      toast.error('Failed to load call logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const simulateCall = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isMissed = Math.random() > 0.5;
      const { data, error } = await supabase
        .from('business_call_logs')
        .insert([{
          profile_id: user.id,
          caller_number: '+1 ' + Math.floor(2000000000 + Math.random() * 8000000000).toString().replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'),
          receiver_number: '+1 (800) 555-0199', // company line
          direction: 'inbound',
          duration_seconds: isMissed ? 0 : Math.floor(Math.random() * 300),
          status: isMissed ? 'missed' : 'completed'
        }])
        .select()
        .single();

      if (error) throw error;
      setCallLogs([data, ...callLogs]);
      toast.success('Incoming call simulated via backend!');
    } catch (err: any) {
      console.error('Error simulating call:', err);
    }
  };

  return {
    callLogs,
    isLoading,
    refetch: fetchLogs,
    simulateCall
  };
}
