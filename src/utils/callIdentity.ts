export interface CallIdentityProfile {
  full_name?: string | null;
  display_name?: string | null;
  username?: string | null;
  phone_number?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cleanValue = (value?: string | null): string => (value || "").trim();

export const looksLikeUuid = (value?: string | null): boolean => UUID_RE.test(cleanValue(value));

export const looksLikePhoneIdentity = (value?: string | null): boolean => {
  const cleaned = cleanValue(value);
  const digits = cleaned.replace(/\D/g, "");
  const letters = cleaned.replace(/[^A-Za-z]/g, "");
  return digits.length >= 7 && letters.length === 0;
};

export function resolveCallDisplayName(
  profile?: CallIdentityProfile | null,
  ...fallbacks: Array<string | null | undefined>
): string {
  const candidates = [
    profile?.full_name,
    profile?.display_name,
    profile?.username,
    ...fallbacks,
    profile?.phone_number,
    profile?.email ? cleanValue(profile.email).split("@")[0] : "",
  ];

  for (const candidate of candidates) {
    const cleaned = cleanValue(candidate);
    if (!cleaned || looksLikeUuid(cleaned) || looksLikePhoneIdentity(cleaned)) continue;
    return cleaned;
  }

  return "Unknown";
}

export function resolveCallAvatar(
  profile?: Pick<CallIdentityProfile, "avatar_url"> | null,
  ...fallbacks: Array<string | null | undefined>
): string {
  const candidates = [profile?.avatar_url, ...fallbacks];

  for (const candidate of candidates) {
    const cleaned = cleanValue(candidate);
    if (cleaned) return cleaned;
  }

  return "";
}
