import { CallerIntelligence } from './types';

export function computeTrustScore(data: Partial<CallerIntelligence>): number {
  let score = 50; // baseline

  // Layer 1: Contact status (+40 if saved contact)
  if (data.isContact) score += 40;

  // Layer 2: Community reports (each report -2, floor at 0)
  const reportPenalty = Math.min((data.communityReportCount ?? 0) * 2, 50);
  score -= reportPenalty;

  // Layer 3: Web identity
  if (data.webIdentity?.traiDndRegistered) score -= 30;
  if (data.isBusiness && data.isVerified) score += 20;

  // Layer 4: Carrier signals
  if (data.carrierData?.cliMismatch) score -= 20;
  if (data.carrierData?.numberType === 'Chatr+') score -= 10;
  
  const ageMonths = data.carrierData?.numberAgeMonths ?? 24;
  if (ageMonths < 6) score -= 15;
  if (ageMonths > 24) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getTrustBand(score: number): 'safe' | 'verify' | 'block' {
  if (score >= 80) return 'safe';
  if (score >= 50) return 'verify';
  return 'block';
}

export function getConfidenceLevel(data: Partial<CallerIntelligence>): 'high' | 'medium' | 'low' {
  const signalCount = [
    data.isContact,
    data.communityLookupCount !== undefined && data.communityLookupCount > 100,
    data.webIdentity !== null,
    data.carrierData !== undefined
  ].filter(Boolean).length;

  if (signalCount >= 3) return 'high';
  if (signalCount >= 2) return 'medium';
  return 'low';
}
