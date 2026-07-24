import { supabase } from '@/integrations/supabase/client';
import { fetchSharedProfile, rememberSharedProfile } from './sharedProfileCache';
import { SharedIdentityProfile } from './sharedIdentityResolver';

export const fetchConversationPeerProfile = async (
  conversationId: string,
  currentUserId: string
): Promise<SharedIdentityProfile | null> => {
  const { data: participant, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', currentUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[platformParity] participant hydration failed', { conversationId, error });
    return null;
  }

  if (!participant?.user_id) return null;
  return fetchSharedProfile(participant.user_id);
};

export const normalizeConversationProfile = (
  profile?: SharedIdentityProfile | null,
  fallbackName?: string | null
): SharedIdentityProfile | null => rememberSharedProfile(profile, fallbackName);
