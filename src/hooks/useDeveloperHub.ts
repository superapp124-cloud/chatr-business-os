import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  last_used_at: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  name: string;
  endpoint_url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export function useDeveloperHub() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [keysRes, webhooksRes] = await Promise.all([
        supabase.from('api_keys').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
        supabase.from('webhooks').select('*').eq('profile_id', user.id).order('created_at', { ascending: false })
      ]);

      if (keysRes.error) throw keysRes.error;
      if (webhooksRes.error) throw webhooksRes.error;

      setApiKeys(keysRes.data || []);
      setWebhooks(webhooksRes.data || []);
    } catch (err: any) {
      console.error('Error fetching developer data:', err);
      toast.error('Failed to load developer data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateApiKey = async (name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // In a real app, generate a secure random string and hash it.
      // Here we simulate generating a key.
      const rawKey = 'pk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const keyHash = btoa(rawKey); // Mock hash

      const { data, error } = await supabase
        .from('api_keys')
        .insert([{
          profile_id: user.id,
          name,
          key_hash: keyHash
        }])
        .select()
        .single();

      if (error) throw error;
      setApiKeys([data, ...apiKeys]);
      toast.success('API Key generated successfully');
      
      // Return the raw key ONLY ONCE so the UI can display it
      return rawKey;
    } catch (err: any) {
      console.error('Error generating API key:', err);
      toast.error('Failed to generate API key');
      return null;
    }
  };

  const createWebhook = async (name: string, endpoint_url: string, events: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('webhooks')
        .insert([{
          profile_id: user.id,
          name,
          endpoint_url,
          events,
          secret: 'whsec_' + Math.random().toString(36).substring(2, 15)
        }])
        .select()
        .single();

      if (error) throw error;
      setWebhooks([data, ...webhooks]);
      toast.success('Webhook created successfully');
      return data;
    } catch (err: any) {
      console.error('Error creating webhook:', err);
      toast.error('Failed to create webhook');
      return null;
    }
  };

  return {
    apiKeys,
    webhooks,
    isLoading,
    refetch: fetchData,
    generateApiKey,
    createWebhook
  };
}
