import { supabase } from '@/integrations/supabase/client';

export interface SharedIdentityProfile {
  id?: string | null;
  username?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  email?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
  [key: string]: unknown;
}

const clean = (value?: string | null): string => (value || '').trim();
const looksLikeUuid = (value: string): boolean => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
);

export const resolveSharedDisplayName = (
  profile?: SharedIdentityProfile | null,
  fallback?: string | null
): string => {
  const candidates = [
    profile?.full_name,
    profile?.display_name,
    profile?.username,
    fallback,
    profile?.phone_number,
    profile?.email ? clean(profile.email).split('@')[0] : '',
  ];

  // Try to find a valid non-UUID candidate first
  for (const candidate of candidates) {
    const value = clean(candidate);
    if (!value || looksLikeUuid(value)) continue;
    return value;
  }

  // Fallback: If we have a UUID username/id, format it nicely
  for (const candidate of candidates) {
    const value = clean(candidate);
    if (value && looksLikeUuid(value)) {
      return `User-${value.slice(0, 6)}`;
    }
  }

  return 'Contact';
};

export const resolveSharedAvatarUrl = (avatarUrl?: string | null): string => {
  const value = clean(avatarUrl);
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.includes('/storage/v1/object/')) return value;

  const normalized = value.replace(/^\/+/, '');
  const [bucketCandidate, ...rest] = normalized.split('/');
  const knownBuckets = new Set(['avatars', 'profile-avatars', 'user-avatars']);

  if (knownBuckets.has(bucketCandidate) && rest.length > 0) {
    return supabase.storage.from(bucketCandidate).getPublicUrl(rest.join('/')).data.publicUrl;
  }

  return supabase.storage.from('avatars').getPublicUrl(normalized).data.publicUrl;
};

export const normalizeSharedIdentity = (
  profile?: SharedIdentityProfile | null,
  fallbackName?: string | null
): SharedIdentityProfile | null => {
  if (!profile) return null;
  const displayName = resolveSharedDisplayName(profile, fallbackName);

  return {
    ...profile,
    username: displayName,
    avatar_url: resolveSharedAvatarUrl(profile.avatar_url),
  };
};
