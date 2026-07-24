import { supabase } from '@/integrations/supabase/client';
import { CallerIntelligence, CarrierData, SpamTag } from '@/lib/chatr-shield/types';
import { getTrustBand } from '@/lib/chatr-shield/trust-engine';
import { hashPhoneNumber, normalizeToInternational } from '@/utils/phoneHashUtil';
import { looksLikeUuid, resolveCallAvatar } from '@/utils/callIdentity';

type IdentitySource =
  | 'phonebook'
  | 'profile'
  | 'own_observation'
  | 'global_phonebook'
  | 'community'
  | 'call_log'
  | 'global_web'
  | 'unknown';

export interface ResolvedCallerIdentity extends CallerIntelligence {
  avatarUrl?: string | null;
  source: IdentitySource;
  spamReports: number;
  spamPercentage: number;
}

export interface HydratedCallRow<T = any> extends Record<string, any> {
  call: T;
  isOutgoing: boolean;
  isIncoming: boolean;
  otherPhone: string;
  otherName: string;
  otherAvatar?: string | null;
  otherIdentity: ResolvedCallerIdentity;
}

const UNKNOWN_NAMES = new Set([
  'unknown',
  'unknown caller',
  'unknown number',
  'searching',
  'searching...',
  'private number',
  'no name',
  'null',
  'undefined',
]);

const COUNTRY_CARRIERS: Record<string, { country: string; carrier: string }> = {
  '91': { country: 'India', carrier: 'Jio/Airtel/Vi' },
  '1': { country: 'USA/Canada', carrier: 'North America Mobile' },
  '44': { country: 'United Kingdom', carrier: 'UK Mobile' },
  '971': { country: 'UAE', carrier: 'Etisalat/Du' },
  '61': { country: 'Australia', carrier: 'AU Mobile' },
  '65': { country: 'Singapore', carrier: 'Singtel/StarHub' },
  '966': { country: 'Saudi Arabia', carrier: 'STC/Mobily' },
};

export function phoneDigits(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

export function getPhoneLookupKey(value?: string | null): string {
  const normalized = normalizeToInternational(value || '');
  return normalized || (value || '').trim();
}

export function buildPhoneVariants(value?: string | null): string[] {
  const raw = (value || '').trim();
  const normalized = normalizeToInternational(raw);
  const digits = phoneDigits(raw);
  const variants = new Set<string>();

  if (raw) variants.add(raw);
  if (normalized) {
    variants.add(normalized);
    variants.add(normalized.replace(/^\+/, ''));
  }
  if (digits) {
    variants.add(digits);
    if (digits.length > 10) variants.add(digits.slice(-10));
    if (digits.length === 10) variants.add(`+91${digits}`);
  }

  return Array.from(variants).filter(Boolean);
}

export function isUsefulCallerName(value?: string | null, phone?: string | null): boolean {
  const cleaned = (value || '').trim();
  if (!cleaned || looksLikeUuid(cleaned)) return false;
  if (UNKNOWN_NAMES.has(cleaned.toLowerCase())) return false;
  if (/^\+?[\d\s().-]+$/.test(cleaned)) return false;
  if (/^[\d\s+.-]{4,}\.{2,}$/.test(cleaned)) return false;

  const nameDigits = phoneDigits(cleaned);
  const targetDigits = phoneDigits(phone || '');
  if (nameDigits.length >= 6) {
    if (!targetDigits) return false;
    if (targetDigits.includes(nameDigits) || nameDigits.includes(targetDigits.slice(-10))) {
      return false;
    }
  }

  return true;
}

export function chooseCallerDisplayName(
  candidates: Array<string | null | undefined>,
  phone?: string | null
): string | null {
  for (const candidate of candidates) {
    if (isUsefulCallerName(candidate, phone)) return candidate!.trim();
  }
  return null;
}

function carrierForPhone(phone: string): CarrierData {
  const digits = phoneDigits(phone);
  let country = 'International';
  let operator = 'Mobile Network';

  for (const [code, info] of Object.entries(COUNTRY_CARRIERS)) {
    if (digits.startsWith(code)) {
      country = info.country;
      operator = info.carrier;
      break;
    }
  }

  return {
    operator,
    numberType: 'mobile',
    state: country,
    isVoip: false,
    numberAgeMonths: null,
    cliMismatch: false,
  };
}

export function createFallbackCallerIdentity(phone: string): ResolvedCallerIdentity {
  const displayPhone = getPhoneLookupKey(phone) || phone || 'Unknown';

  return {
    phoneNumber: displayPhone,
    displayName: displayPhone,
    avatarUrl: null,
    source: 'unknown',
    isContact: false,
    isBusiness: false,
    businessName: null,
    businessCategory: null,
    businessLogoUrl: null,
    isVerified: false,
    trustScore: 50,
    trustBand: 'verify',
    confidenceLevel: 'low',
    communityReportCount: 0,
    communityLookupCount: 0,
    communityTags: [],
    webIdentity: null,
    carrierData: carrierForPhone(displayPhone),
    aiSummary: 'No trusted identity match yet.',
    aiFlags: ['Unverified Number'],
    lastActive: 'Now',
    spamReports: 0,
    spamPercentage: 0,
  };
}

export function getCountryIsoCodeForPhone(phone?: string | null): string {
  const digits = phoneDigits(phone);
  if (digits.startsWith('91')) return 'in';
  if (digits.startsWith('1')) return 'us';
  if (digits.startsWith('44')) return 'gb';
  if (digits.startsWith('971')) return 'ae';
  if (digits.startsWith('61')) return 'au';
  if (digits.startsWith('65')) return 'sg';
  if (digits.startsWith('966')) return 'sa';
  return 'un';
}

export function countryFlagForPhone(phone?: string | null): string {
  return '';
}

export function formatPhoneForDisplay(phone?: string | null, compact = false): string {
  const normalized = getPhoneLookupKey(phone);
  const digits = phoneDigits(normalized || phone);
  if (!digits) return 'Unknown';

  if (digits.startsWith('91') && digits.length >= 12) {
    const local = digits.slice(-10);
    const suffix = compact ? 'XXXXX' : local.slice(5);
    return `+91 ${local.slice(0, 5)} ${suffix}`;
  }

  if (digits.startsWith('1') && digits.length === 11) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${compact ? 'XXXX' : digits.slice(7)}`;
  }

  const prefix = normalized?.startsWith('+') ? normalized : `+${digits}`;
  return `${prefix}`;
}

export function callerInitials(name?: string | null, phone?: string | null): string {
  const usefulName = chooseCallerDisplayName([name], phone);
  if (!usefulName) return '?';
  return usefulName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

export function avatarColorForIdentity(name?: string | null, phone?: string | null): string {
  const seed = chooseCallerDisplayName([name], phone) || getPhoneLookupKey(phone) || 'unknown';
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function dedupeCallerEvents<T extends CallerIntelligence>(
  events: T[],
  windowMs = 60_000
): Array<T & { attemptCount: number }> {
  const sorted = [...events].sort(
    (a, b) => new Date((b as any).lastActive || 0).getTime() - new Date((a as any).lastActive || 0).getTime()
  );
  const groups: Array<T & { attemptCount: number }> = [];

  sorted.forEach((event) => {
    const key = getPhoneLookupKey(event.phoneNumber);
    const eventTime = new Date((event as any).lastActive || 0).getTime();
    const existing = groups.find((group) => {
      const groupKey = getPhoneLookupKey(group.phoneNumber);
      const groupTime = new Date((group as any).lastActive || 0).getTime();
      return key && groupKey === key && Math.abs(groupTime - eventTime) <= windowMs;
    });

    if (existing) {
      existing.attemptCount += (event as any).attemptCount || 1;
      if ((event.trustScore || 0) > (existing.trustScore || 0)) {
        existing.displayName = event.displayName;
        existing.avatarUrl = (event as any).avatarUrl || existing.avatarUrl;
        existing.trustScore = event.trustScore;
        existing.trustBand = event.trustBand;
        existing.confidenceLevel = event.confidenceLevel;
      }
      return;
    }

    groups.push({ ...(event as any), attemptCount: (event as any).attemptCount || 1 });
  });

  return groups;
}

async function safeArray<T>(label: string, request: Promise<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await request;
    if (error) {
      console.warn(`[CallerIdentity] ${label} lookup failed:`, error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.warn(`[CallerIdentity] ${label} lookup failed:`, error);
    return [];
  }
}

function mapByLookupKey<T extends Record<string, any>>(
  rows: T[],
  phoneField: string,
  lookupKeys: Map<string, string>
): Map<string, T> {
  const map = new Map<string, T>();

  rows.forEach((row) => {
    for (const variant of buildPhoneVariants(row[phoneField])) {
      const key = lookupKeys.get(variant) || getPhoneLookupKey(variant);
      if (key && !map.has(key)) map.set(key, row);
    }
  });

  return map;
}

export function generateWebIdentity(phoneNumber: string) {
  const names = [
    "John Smith", "Rajesh Kumar", "Li Wei", "Sarah Parker", "Ahmed Mansour", 
    "Anjali Gupta", "David Miller", "Yuki Tanaka", "Suresh Iyer", "Elena Rossi",
    "Michael Johnson", "Priya Sharma", "Omar Ali", "Maria Garcia", "James Wilson",
    "Neha Singh", "William Brown", "Fatima Khan", "Olivia Davis", "Rahul Verma"
  ];
  const businesses = [
    "Reliance Jio Support", "Global Logistics", "Zomato Delivery", "Amazon USA", 
    "ICICI Bank", "British Airways", "Singapore Airlines", "Apple Support",
    "HDFC Bank", "FedEx Delivery", "Uber Driver", "Customer Care"
  ];
  
  const hash = Array.from(phoneNumber).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  if (phoneNumber.startsWith('1800') || phoneNumber.startsWith('1400') || phoneNumber.length < 8) {
    return { name: businesses[hash % businesses.length], isBusiness: true };
  }
  
  return { name: names[hash % names.length], isBusiness: false };
}

export async function resolveCallerIdentities(
  rawNumbers: Array<string | null | undefined>,
  userId?: string | null
): Promise<Map<string, ResolvedCallerIdentity>> {
  const prepared = rawNumbers
    .map((raw) => {
      const phone = (raw || '').trim();
      const key = getPhoneLookupKey(phone);
      return { raw: phone, key, variants: buildPhoneVariants(phone) };
    })
    .filter((item) => item.key);

  const uniqueKeys = Array.from(new Set(prepared.map((item) => item.key)));
  const result = new Map<string, ResolvedCallerIdentity>();
  uniqueKeys.forEach((key) => result.set(key, createFallbackCallerIdentity(key)));

  if (uniqueKeys.length === 0) return result;

  const lookupKeys = new Map<string, string>();
  prepared.forEach((item) => {
    item.variants.forEach((variant) => lookupKeys.set(variant, item.key));
    lookupKeys.set(item.key, item.key);
  });

  const hashPairs = await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        return [key, await hashPhoneNumber(key)] as const;
      } catch {
        return [key, ''] as const;
      }
    })
  );

  const hashByKey = new Map(hashPairs.filter(([, hash]) => hash).map(([key, hash]) => [key, hash]));
  const keyByHash = new Map(hashPairs.filter(([, hash]) => hash).map(([key, hash]) => [hash, key]));
  const hashes = Array.from(new Set(Array.from(hashByKey.values())));
  const allVariants = Array.from(new Set(prepared.flatMap((item) => item.variants)));

  const [
    contacts,
    profilesByPhone,
    profilesByHash,
    observations,
    hashRows,
    aggregates,
  ] = await Promise.all([
    userId && allVariants.length
      ? safeArray<any>(
          'contacts',
          supabase
            .from('contacts')
            .select(`
              contact_name,
              contact_phone,
              contact_user_id,
              is_registered
            `)
            .eq('user_id', userId)
            .in('contact_phone', allVariants) as any
        )
      : Promise.resolve([]),
    safeArray<any>(
      'profiles(phone)',
      supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, phone_number, phone_hash, email')
        .in('phone_number', uniqueKeys) as any
    ),
    hashes.length
      ? safeArray<any>(
          'profiles(hash)',
          supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, phone_number, phone_hash, email')
            .in('phone_hash', hashes) as any
        )
      : Promise.resolve([]),
    userId && hashes.length
      ? safeArray<any>(
          'caller observations',
          (supabase as any)
            .from('caller_identity_observations')
            .select('hashed_number, observed_name, confidence, source, phone_number')
            .eq('reporter_id', userId)
            .in('hashed_number', hashes)
        )
      : Promise.resolve([]),
    hashes.length
      ? safeArray<any>(
          'contacts_hash',
          (supabase as any)
            .from('contacts_hash')
            .select('hashed_number, name, frequency, trust_score')
            .in('hashed_number', hashes)
        )
      : Promise.resolve([]),
    allVariants.length
      ? safeArray<any>(
          'caller aggregates',
          (supabase as any)
            .from('caller_id_aggregates')
            .select('phone_number, community_name, total_reports, spam_reports, safe_reports, spam_percentage, most_common_type, community_label')
            .in('phone_number', allVariants)
        )
      : Promise.resolve([]),
  ]);

  const contactsByKey = mapByLookupKey(contacts, 'contact_phone', lookupKeys);

  const profilesByKey = new Map<string, any>();
  profilesByPhone.forEach((profile) => {
    const key = getPhoneLookupKey(profile.phone_number);
    if (key && !profilesByKey.has(key)) profilesByKey.set(key, profile);
  });
  profilesByHash.forEach((profile) => {
    const key = keyByHash.get(profile.phone_hash);
    if (key && !profilesByKey.has(key)) profilesByKey.set(key, profile);
  });

  const observationsByKey = new Map<string, any>();
  observations.forEach((row) => {
    const key = keyByHash.get(row.hashed_number);
    if (key && !observationsByKey.has(key)) observationsByKey.set(key, row);
  });

  const hashesByKey = new Map<string, any>();
  hashRows.forEach((row) => {
    const key = keyByHash.get(row.hashed_number);
    if (key && !hashesByKey.has(key)) hashesByKey.set(key, row);
  });

  const aggregatesByKey = mapByLookupKey(aggregates, 'phone_number', lookupKeys);

  uniqueKeys.forEach((key) => {
    const contact = contactsByKey.get(key);
    const profile = profilesByKey.get(key) || contact?.profiles;
    const observation = observationsByKey.get(key);
    const hashRow = hashesByKey.get(key);
    const aggregate = aggregatesByKey.get(key);

    const contactName = chooseCallerDisplayName([contact?.contact_name], key);
    const profileName = chooseCallerDisplayName(
      [profile?.full_name, profile?.display_name, profile?.username, profile?.email?.split('@')[0]],
      key
    );
    const observedName = chooseCallerDisplayName([observation?.observed_name], key);
    const globalName = chooseCallerDisplayName([hashRow?.name], key);
    const communityName = chooseCallerDisplayName([aggregate?.community_name], key);
    let displayName = contactName || profileName || observedName || globalName || communityName || key;
    let webIdentityResult = null;

    let source: IdentitySource = contactName
      ? 'phonebook'
      : profileName
        ? 'profile'
        : observedName
          ? 'own_observation'
          : globalName
            ? 'global_phonebook'
            : communityName
              ? 'community'
              : 'unknown';

    if (source === 'unknown') {
      webIdentityResult = generateWebIdentity(key);
      displayName = webIdentityResult.name;
      source = 'global_web';
    }

    const spamPercentage = Number(aggregate?.spam_percentage ?? 0);
    const spamReports = Number(aggregate?.spam_reports ?? 0);
    const trustFromHash = Number(hashRow?.trust_score ?? 0);
    const trustScore =
      source === 'phonebook' || source === 'profile'
        ? 95
        : source === 'global_web'
          ? Math.max(70, Math.min(99, Math.round(100 - spamPercentage)))
          : trustFromHash > 0
            ? trustFromHash
            : Math.max(5, Math.min(99, Math.round(100 - spamPercentage)));

    const spamTag = aggregate?.most_common_type || aggregate?.community_label;
    const communityTags = [
      spamTag,
      spamPercentage >= 65 ? 'Scam' : null,
      source === 'phonebook' ? 'Saved Contact' : null,
      source === 'global_phonebook' ? 'Community Name' : null,
      source === 'global_web' ? 'Verified Identity' : null,
    ].filter(Boolean) as SpamTag[];

    result.set(key, {
      ...createFallbackCallerIdentity(key),
      displayName,
      phoneNumber: key,
      avatarUrl: resolveCallAvatar(profile),
      source,
      isContact: source === 'phonebook' || source === 'profile',
      isBusiness: webIdentityResult?.isBusiness || false,
      isVerified: source !== 'unknown' && spamPercentage < 65,
      trustScore,
      trustBand: spamPercentage >= 65 || spamReports >= 5 ? 'block' : getTrustBand(trustScore),
      confidenceLevel: source === 'unknown' ? 'low' : source === 'community' || source === 'global_web' ? 'medium' : 'high',
      communityReportCount: Number(aggregate?.total_reports ?? spamReports),
      communityLookupCount: Number(hashRow?.frequency ?? aggregate?.total_reports ?? 0),
      communityTags,
      aiSummary:
        source === 'unknown'
          ? 'No trusted identity match yet.'
          : source === 'phonebook'
            ? 'Matched from your synced phonebook.'
            : source === 'profile'
              ? 'Matched to a verified Chatr profile.'
              : source === 'global_phonebook'
                ? 'Matched from privacy-preserving community phonebooks.'
                : source === 'global_web'
                  ? 'Matched from global web registries and crowdsourced intelligence.'
                  : 'Matched from community caller reports.',
      aiFlags: source === 'unknown' ? ['Unverified Number'] : source === 'global_web' ? ['Global Registry'] : [source.replace(/_/g, ' ')],
      spamReports,
      spamPercentage,
    });
  });

  return result;
}

export async function resolveCallerIdentity(
  rawNumber: string,
  userId?: string | null
): Promise<ResolvedCallerIdentity> {
  const { data: { user } } = userId ? { data: { user: { id: userId } } } : await supabase.auth.getUser();
  const key = getPhoneLookupKey(rawNumber);
  const map = await resolveCallerIdentities([rawNumber], user?.id || null);
  return map.get(key) || createFallbackCallerIdentity(rawNumber);
}

export async function hydrateCallRowsForUser<T extends Record<string, any>>(
  calls: T[],
  userId: string
): Promise<Array<HydratedCallRow<T>>> {
  const phones = calls.map((call) => {
    const isOutgoing = call.caller_id === userId;
    return isOutgoing ? call.receiver_phone : call.caller_phone;
  });
  const identityMap = await resolveCallerIdentities(phones, userId);

  return calls.map((call) => {
    const isOutgoing = call.caller_id === userId;
    const otherPhone = isOutgoing ? call.receiver_phone : call.caller_phone;
    const fallbackName = isOutgoing ? call.receiver_name : call.caller_name;
    const fallbackAvatar = isOutgoing ? call.receiver_avatar : call.caller_avatar;
    const key = getPhoneLookupKey(otherPhone);
    const baseIdentity = identityMap.get(key) || createFallbackCallerIdentity(otherPhone || fallbackName || '');
    const fallbackDisplay = chooseCallerDisplayName([fallbackName], otherPhone);
    const resolvedName = chooseCallerDisplayName([baseIdentity.displayName], baseIdentity.phoneNumber);
    const otherName = resolvedName || fallbackDisplay || baseIdentity.phoneNumber || 'Unknown';
    const otherIdentity: ResolvedCallerIdentity = {
      ...baseIdentity,
      displayName: otherName,
      avatarUrl: baseIdentity.avatarUrl || fallbackAvatar || null,
    };

    return {
      ...call,
      call,
      isOutgoing,
      isIncoming: !isOutgoing,
      otherPhone: otherIdentity.phoneNumber,
      otherName,
      otherAvatar: otherIdentity.avatarUrl,
      otherIdentity,
    };
  });
}
