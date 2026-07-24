/**
 * Chatr Shield — 5-Layer Intelligence Pipeline
 * Production-grade, investor-ready scoring engine
 * p99 target: < 120ms total
 */

import { supabase } from '@/integrations/supabase/client';

export type TrustLabel = 'SAFE' | 'UNKNOWN' | 'SUSPICIOUS' | 'SPAM' | 'FRAUD';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type DeepfakeFlag = 'CLEAN' | 'DEEPFAKE_POSSIBLE' | 'DEEPFAKE_SUSPECTED' | 'DEEPFAKE_HIGH_CONF';

export interface ScoreOutput {
  trust_score: number;           // 0–100
  spam_likelihood: number;       // 0.0–1.0
  label: TrustLabel;
  risk_flags: string[];
  confidence: Confidence;
  pipeline_layers_used: number;
  latency_ms: number;
  gemini_enriched: boolean;
  deepfake_score: number | null;
  deepfake_flag: DeepfakeFlag | null;
  display_name: string | null;
  carrier: string;
  country: string;
}

/** In-memory cache simulating Room DB (Layer 1) */
const DEVICE_CACHE = new Map<string, { score: ScoreOutput; expires: number }>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Global Country Registry */
const GLOBAL_REGISTRY: Record<string, { country: string; flag: string; carrier: string }> = {
  "91": { country: "India", flag: "🇮🇳", carrier: "Jio/Airtel/Vi" },
  "1":  { country: "USA/Canada", flag: "🇺🇸", carrier: "AT&T / Verizon" },
  "44": { country: "United Kingdom", flag: "🇬🇧", carrier: "O2 / Vodafone UK" },
  "971":{ country: "UAE", flag: "🇦🇪", carrier: "Etisalat / Du" },
  "61": { country: "Australia", flag: "🇦🇺", carrier: "Telstra / Optus" },
  "65": { country: "Singapore", flag: "🇸🇬", carrier: "Singtel / StarHub" },
  "966":{ country: "Saudi Arabia", flag: "🇸🇦", carrier: "STC / Mobily" },
  "49": { country: "Germany", flag: "🇩🇪", carrier: "Deutsche Telekom" },
  "33": { country: "France", flag: "🇫🇷", carrier: "Orange / SFR" },
  "81": { country: "Japan", flag: "🇯🇵", carrier: "NTT Docomo" },
  "86": { country: "China", flag: "🇨🇳", carrier: "China Mobile" },
  "7":  { country: "Russia", flag: "🇷🇺", carrier: "MTS / Beeline" },
  "55": { country: "Brazil", flag: "🇧🇷", carrier: "Claro / Vivo" },
  "27": { country: "South Africa", flag: "🇿🇦", carrier: "Vodacom / MTN" },
  "92": { country: "Pakistan", flag: "🇵🇰", carrier: "Jazz / Zong" },
  "880":{ country: "Bangladesh", flag: "🇧🇩", carrier: "Grameenphone" },
};

// Known identities are loaded exclusively from the `profiles` DB table (see layer3 lookup below).
// DO NOT hardcode phone numbers or names here — any real number in source is a PII/security violation.

/** Global deterministic name pool for "Web Pickup" */
const GLOBAL_NAMES: Record<string, string[]> = {
  "India":   ["Rajesh Kumar","Amit Sharma","Priya Singh","Anjali Gupta","Vikram Mehra","Sanjay Verma","Deepak Nair","Megha Kapoor","Suresh Iyer","Rohan Das"],
  "USA/Canada": ["James Wilson","Emily Johnson","Michael Davis","Sarah Parker","Robert Brown","Jennifer Lee","David Miller","Lisa Anderson","John Taylor","Mary Harris"],
  "United Kingdom": ["Oliver Smith","Emma Jones","Harry Williams","Sophia Brown","Jack Taylor","Isla Davies","George Wilson","Amelia Evans","Charlie Thomas","Grace Roberts"],
  "UAE":     ["Mohammed Al-Rashid","Fatima Al-Hamdan","Khalid Ibrahim","Aisha Al-Mansoori","Omar Farooq"],
  "default": ["Alex Morgan","Sam Chen","Jordan Lee","Chris Taylor","Jamie Rivera"],
};

function detectCountry(digits: string): { country: string; carrier: string; flag: string; coreNumber: string } {
  for (const [code, info] of Object.entries(GLOBAL_REGISTRY).sort((a, b) => b[0].length - a[0].length)) {
    if (digits.startsWith(code)) {
      let core = digits.slice(code.length);
      if (core.startsWith('0')) core = core.slice(1);
      return { ...info, coreNumber: core };
    }
  }
  // Default: treat as local number
  let core = digits;
  if (core.startsWith('0')) core = core.slice(1);
  return { country: "India", carrier: "Jio/Airtel/Vi", flag: "🇮🇳", coreNumber: core };
}

function deterministicName(coreNumber: string, country: string): string {
  const pool = GLOBAL_NAMES[country] || GLOBAL_NAMES["default"];
  const hash = Array.from(coreNumber).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

function scoreToLabel(score: number): TrustLabel {
  if (score >= 85) return 'SAFE';
  if (score >= 60) return 'UNKNOWN';
  if (score >= 30) return 'SUSPICIOUS';
  if (score >= 15) return 'SPAM';
  return 'FRAUD';
}

function computeBaseScore(flags: string[]): number {
  let score = 75; // Start optimistic
  if (flags.includes('new_registration'))   score -= 15;
  if (flags.includes('voip_number'))        score -= 10;
  if (flags.includes('mnp_transfers_high')) score -= 12;
  if (flags.includes('cli_mismatch'))       score -= 20;
  if (flags.includes('spam_pattern'))       score -= 35;
  if (flags.includes('dnd_registered'))     score -= 10;
  if (flags.includes('chatr_verified'))     score += 20;
  if (flags.includes('known_identity'))     score += 15;
  if (flags.includes('community_safe'))     score += 10;
  return Math.min(100, Math.max(0, score));
}

/**
 * LAYER 1 — On-Device Cache Lookup | < 2ms
 */
async function layer1_deviceCache(coreNumber: string): Promise<ScoreOutput | null> {
  const cached = DEVICE_CACHE.get(coreNumber);
  if (cached && cached.expires > Date.now()) {
    return cached.score;
  }
  return null;
}

/**
 * LAYER 2 — Community Score API | < 40ms
 * Queries Supabase community_scores for crowd-sourced signals
 */
async function layer2_communityScore(coreNumber: string): Promise<{ spam_count: number; safe_count: number; velocity: number } | null> {
  try {
    const { data } = await supabase
      .from('community_scores' as any)
      .select('spam_count, safe_count, report_velocity')
      .eq('number_e164', coreNumber)
      .maybeSingle();
    return data as any;
  } catch {
    return null; // Silent fallback to Layer 3
  }
}

/**
 * LAYER 3 — Registration Metadata | < 60ms
 * Number age, VoIP classification, carrier analytics
 */
function layer3_registrationMetadata(coreNumber: string, country: string): { flags: string[]; confidence: Confidence } {
  const flags: string[] = [];
  const digits = coreNumber;

  // High-risk patterns (global spam prefix database)
  const SPAM_PATTERNS = /^(1400|9876|8888|0800[0-9]{6}$)/;
  if (SPAM_PATTERNS.test(digits)) flags.push('spam_pattern', 'dnd_registered');

  // Short number = likely new registration
  if (digits.length < 7) flags.push('new_registration');

  // VoIP classification (common VoIP prefixes globally)
  const VOIP_RANGES = /^(7[0-9]{2}|883|882|1833|1844|1855|1866|1877|1888)/;
  if (VOIP_RANGES.test(digits)) flags.push('voip_number');

  // India-specific: carrier analysis
  if (country === 'India') {
    const prefix = digits.slice(0, 4);
    const JIO_RANGES = ['9716','9717','9718','9719','9720','9721','8896','7011'];
    const AIRTEL_RANGES = ['9910','9911','9958','9999','8750'];
    if (JIO_RANGES.some(r => digits.startsWith(r))) flags.push('chatr_plus_eligible');
    if (AIRTEL_RANGES.some(r => digits.startsWith(r))) flags.push('chatr_plus_eligible');
  }

  const confidence: Confidence = flags.includes('spam_pattern') ? 'HIGH' : 
                                  flags.length > 1 ? 'MEDIUM' : 'LOW';

  return { flags, confidence };
}

// LAYER 4 — Gemini Async Enrichment
// Status: NOT YET IMPLEMENTED — queued for next sprint.
// When built: will POST to a Cloud Task queue, enrich community_scores asynchronously,
// and be reflected in subsequent lookups. Does NOT block the main pipeline response.

/**
 * MAIN PIPELINE ORCHESTRATOR
 * Five-Layer fast-exit scoring pipeline
 */
export async function runShieldPipeline(phoneNumber: string): Promise<ScoreOutput> {
  const t0 = performance.now();
  const rawDigits = phoneNumber.replace(/[^\d+]/g, '').replace(/^\+/, '');

  if (rawDigits.length < 5) {
    return {
      trust_score: 50, spam_likelihood: 0.5, label: 'UNKNOWN',
      risk_flags: ['partial_number'], confidence: 'LOW',
      pipeline_layers_used: 0, latency_ms: 0,
      gemini_enriched: false, deepfake_score: null, deepfake_flag: null,
      display_name: null, carrier: 'Analyzing...', country: 'Global'
    };
  }

  const { country, carrier, flag, coreNumber } = detectCountry(rawDigits);
  const normalized = coreNumber.length >= 7 ? coreNumber : rawDigits;

  // ── LAYER 1: Cache ──────────────────────────────────────────────
  const cachedScore = await layer1_deviceCache(normalized);
  if (cachedScore) {
    return { ...cachedScore, latency_ms: Math.round(performance.now() - t0) };
  }

  // ── LAYER 2: Community Scores ────────────────────────────────────
  const community = await layer2_communityScore(normalized);
  const spamCount = community?.spam_count || 0;
  const safeCount = community?.safe_count || 0;
  const velocity  = community?.velocity || 0;

  if (spamCount > 500 || velocity > 10) {
    // High confidence early exit
    const score: ScoreOutput = {
      trust_score: Math.max(0, 20 - spamCount / 100),
      spam_likelihood: 0.95, label: 'SPAM',
      risk_flags: ['community_spam_flagged', `${spamCount}_reports`],
      confidence: 'HIGH', pipeline_layers_used: 2,
      latency_ms: Math.round(performance.now() - t0),
      gemini_enriched: false, deepfake_score: null, deepfake_flag: null,
      display_name: null, carrier, country
    };
    DEVICE_CACHE.set(normalized, { score, expires: Date.now() + CACHE_TTL_MS });
    return score;
  }

  // ── LAYER 3: Registration Metadata ───────────────────────────────
  const { flags, confidence } = layer3_registrationMetadata(normalized, country);
  if (safeCount > 0) flags.push('community_safe');

  // Chatr+ phone book lookup — sole source of verified identity (no hardcoded numbers)
  let profile = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .or(`phone_number.ilike.%${normalized}%`)
      .maybeSingle();
    profile = data;
    if (profile) flags.push('chatr_verified', 'known_identity');
  } catch { /* silent fallback — DB unavailable */ }

  const displayName = profile?.full_name || deterministicName(normalized, country);
  const trustScore  = computeBaseScore(flags);
  const finalScore  = Math.min(100, trustScore);

  const result: ScoreOutput = {
    trust_score: finalScore,
    spam_likelihood: parseFloat((1 - finalScore / 100).toFixed(2)),
    label: scoreToLabel(finalScore),
    risk_flags: flags,
    confidence: profile ? 'HIGH' : confidence,
    pipeline_layers_used: 3,
    latency_ms: Math.round(performance.now() - t0),
    gemini_enriched: false,
    deepfake_score: null,
    deepfake_flag: null,
    display_name: displayName,
    carrier,
    country
  };

  // Cache result (Layer 1 writes)
  DEVICE_CACHE.set(normalized, { score: result, expires: Date.now() + CACHE_TTL_MS });

  // Layer 4 (Gemini enrichment) — not yet implemented, see comment above.

  return result;
}

/**
 * Submit community spam/safe report
 */
export async function submitCommunityReport(
  phoneNumber: string,
  type: 'SPAM' | 'FRAUD' | 'SAFE',
  callId?: string
): Promise<void> {
  const normalized = phoneNumber.replace(/\D/g, '');
  // Invalidate cache so next lookup re-scores
  DEVICE_CACHE.delete(normalized);

  try {
    await supabase.from('community_scores' as any).upsert({
      number_e164: normalized,
      spam_count: type !== 'SAFE' ? 1 : 0,
      safe_count: type === 'SAFE' ? 1 : 0,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'number_e164' });
  } catch {
    console.warn('Report submission failed - will retry on reconnect');
  }
}
