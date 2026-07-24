import { CallerIntelligence } from './types';
import {
  chooseCallerDisplayName,
  isUsefulCallerName,
  resolveCallerIdentity,
} from '@/utils/callerIdentityResolver';

const intelCache = new Map<string, CallerIntelligence>();

/**
 * Global Country Code Registry (Simulated for Global Intelligence)
 */
const GLOBAL_REGISTRY: Record<string, { country: string; flag: string; carrier: string }> = {
  "91": { country: "India", flag: "🇮🇳", carrier: "Jio/Airtel" },
  "1": { country: "USA/Canada", flag: "🇺🇸", carrier: "AT&T / Verizon" },
  "44": { country: "United Kingdom", flag: "🇬🇧", carrier: "O2 / Vodafone" },
  "971": { country: "UAE", flag: "🇦🇪", carrier: "Etisalat / Du" },
  "61": { country: "Australia", flag: "🇦🇺", carrier: "Telstra" },
  "65": { country: "Singapore", flag: "🇸🇬", carrier: "Singtel" },
  "966": { country: "Saudi Arabia", flag: "🇸🇦", carrier: "STC" },
};

// Known identities are resolved exclusively via resolveCallerIdentity (Supabase profiles lookup).
// DO NOT hardcode phone numbers or names here — any real number in source is a PII/security violation.


/**
 * Global Number Normalization logic.
 */
function analyzeGlobalNumber(phoneNumber: string) {
  if (!phoneNumber) {
    return { country: "Unknown", carrier: "Unknown", coreNumber: "", isGlobal: false };
  }
  let digits = phoneNumber.replace(/\D/g, '');
  let country = "International";
  let carrier = "Global Network";
  let coreNumber = digits;

  // Detect Country & Strip Prefix
  for (const [code, info] of Object.entries(GLOBAL_REGISTRY)) {
    if (phoneNumber.startsWith('+' + code) || (digits.startsWith(code) && digits.length > 8)) {
      country = info.country;
      carrier = info.carrier;
      coreNumber = digits.slice(code.length);
      break;
    }
  }

  // Handle leading 0 for regional formats
  if (coreNumber.length > 10 && coreNumber.startsWith('0')) {
    coreNumber = coreNumber.slice(1);
  }

  return { country, carrier, coreNumber, isGlobal: country !== "International" };
}

/**
 * Performs a deep intelligence lookup across 5 layers.
 */
export async function performDeepIntelligenceLookup(phoneNumber: string): Promise<CallerIntelligence> {
  if (!phoneNumber) {
    return {
      phoneNumber: 'Unknown',
      displayName: 'Unknown',
      isContact: false,
      isBusiness: false,
      isVerified: false,
      trustScore: 0,
      trustBand: 'verify',
      confidenceLevel: 'low',
      aiSummary: 'No phone number provided.',
      aiFlags: [],
      carrierData: {
        operator: "Unknown",
        numberType: "mobile",
        state: "Unknown",
        isVoip: false,
        numberAgeMonths: 0,
        cliMismatch: false
      },
      lastActive: 'Never'
    } as any;
  }

  if (intelCache.has(phoneNumber)) {
    return intelCache.get(phoneNumber)!;
  }
  const { country } = analyzeGlobalNumber(phoneNumber);
  const digits = phoneNumber.replace(/\D/g, '');

  // Layer 0: Trust-Building Logic
  if (digits.length < 5) {
    return {
      phoneNumber,
      displayName: null,
      isContact: false,
      isBusiness: false,
      isVerified: false,
      trustScore: 50,
      trustBand: 'verify',
      confidenceLevel: 'low',
      aiSummary: `Scanning prefix (${phoneNumber})... Enter more digits for global identity scan.`,
      aiFlags: ['Partial Number'],
      carrierData: {
        operator: "Analyzing...",
        numberType: "mobile",
        state: country,
        isVoip: false,
        numberAgeMonths: 0,
        cliMismatch: false
      },
      lastActive: 'Now'
    } as any;
  }

  const resolved = await resolveCallerIdentity(phoneNumber);
  const realName = chooseCallerDisplayName([resolved.displayName], resolved.phoneNumber);
  const displayName = realName || resolved.phoneNumber || phoneNumber;

  const result = {
    ...resolved,
    displayName,
    phoneNumber: resolved.phoneNumber || phoneNumber,
    carrierData: {
      ...resolved.carrierData,
      state: resolved.carrierData?.state || country,
    },
    aiSummary: isUsefulCallerName(displayName, resolved.phoneNumber)
      ? resolved.aiSummary
      : 'No trusted caller name found yet. Sync contacts or community reports to improve this match.',
    aiFlags: resolved.source === 'unknown' ? ['Unverified Number'] : resolved.aiFlags,
    lastActive: 'Just now',
  } as CallerIntelligence;

  intelCache.set(phoneNumber, result);
  return result;
}
