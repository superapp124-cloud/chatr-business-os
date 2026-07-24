export type SpamTag =
  | 'Telemarketer'
  | 'Robocall'
  | 'Scam'
  | 'Bank'
  | 'Hospital'
  | 'OTP'
  | 'Food Delivery'
  | 'Insurance'
  | 'Loan'
  | 'Real Estate'
  | 'Unverified';

export interface CarrierData {
  operator: string;
  numberType: 'mobile' | 'landline' | 'Chatr+' | 'tollfree' | 'virtual';
  state: string;
  isVoip: boolean;
  numberAgeMonths: number | null;
  cliMismatch: boolean;
}

export interface WebIdentity {
  businessName: string | null;
  category: string | null;
  traiDndRegistered: boolean;
  webMentionsCount: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sourceUrls: string[];
}

export interface CallerIntelligence {
  phoneNumber: string;
  displayName: string | null;
  isContact: boolean;
  isBusiness: boolean;
  businessName: string | null;
  businessCategory: string | null;
  businessLogoUrl: string | null;
  isVerified: boolean;
  trustScore: number;            // 0-100
  trustBand: 'safe' | 'verify' | 'block';
  confidenceLevel: 'high' | 'medium' | 'low';
  communityReportCount: number;
  communityLookupCount: number;
  communityTags: SpamTag[];
  webIdentity: WebIdentity | null;
  carrierData: CarrierData;
  aiSummary: string;
  aiFlags: string[];
  lastActive: string;
}

export interface ShieldStats {
  callsScreened: number;
  spamBlocked: number;
  communityReports: number;
  trustChecks: number;
}
