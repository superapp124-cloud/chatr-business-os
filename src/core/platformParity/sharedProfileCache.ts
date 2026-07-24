import { supabase } from '@/integrations/supabase/client';
import { normalizeSharedIdentity, SharedIdentityProfile } from './sharedIdentityResolver';

const profileCache = new Map<string, SharedIdentityProfile>();

const summarizeProfileError = (error: unknown): string => {
  if (!error || typeof error !== 'object') return String(error);
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string };
  return [
    maybeError.code && `code=${maybeError.code}`,
    maybeError.message && `message=${maybeError.message}`,
    maybeError.details && `details=${maybeError.details}`,
    maybeError.hint && `hint=${maybeError.hint}`,
  ].filter(Boolean).join(' ');
};

export const getCachedSharedProfile = (userId?: string | null): SharedIdentityProfile | null => {
  if (!userId) return null;
  return profileCache.get(userId) || null;
};

export const rememberSharedProfile = (
  profile?: SharedIdentityProfile | null,
  fallbackName?: string | null
): SharedIdentityProfile | null => {
  const normalized = normalizeSharedIdentity(profile, fallbackName);
  if (normalized?.id) {
    profileCache.set(normalized.id, normalized);
  }
  return normalized;
};

export const fetchSharedProfile = async (
  userId: string,
  fallbackName?: string | null
): Promise<SharedIdentityProfile | null> => {
  const cached = getCachedSharedProfile(userId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, phone_number, email, is_online, last_seen')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn(`[platformParity] profile hydration failed user=${userId} ${summarizeProfileError(error)}`);
    return null;
  }

  return rememberSharedProfile(data, fallbackName);
};
