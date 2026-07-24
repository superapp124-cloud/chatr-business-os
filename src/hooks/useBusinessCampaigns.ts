import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessCampaign {
  id: string;
  profile_id: string;
  name: string;
  type: 'whatsapp' | 'email' | 'sms' | 'push';
  audience_segment: string;
  content: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  sent_count: number;
  open_count: number;
  click_count: number;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export function useBusinessCampaigns() {
  const [campaigns, setCampaigns] = useState<BusinessCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      toast.error('Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const createCampaign = async (name: string, type: BusinessCampaign['type'], audience_segment: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('business_campaigns')
        .insert([{
          profile_id: user.id,
          name,
          type,
          audience_segment,
          status: 'draft'
        }])
        .select()
        .single();

      if (error) throw error;
      setCampaigns([data, ...campaigns]);
      toast.success('Campaign created');
      return data;
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      toast.error('Failed to create campaign');
      return null;
    }
  };

  const updateCampaign = async (id: string, updates: Partial<BusinessCampaign>) => {
    try {
      const { error } = await supabase
        .from('business_campaigns')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setCampaigns(campaigns.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } as BusinessCampaign : c));
      toast.success('Campaign saved');
      return true;
    } catch (err: any) {
      console.error('Error updating campaign:', err);
      toast.error('Failed to update campaign');
      return false;
    }
  };

  return {
    campaigns,
    isLoading,
    refetch: fetchCampaigns,
    createCampaign,
    updateCampaign
  };
}
