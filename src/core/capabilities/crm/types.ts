import { BaseArtifact } from '../hr/types';

export interface LeadArtifact extends BaseArtifact {
  type: 'LeadArtifact';
  companyName: string;
  contactName: string;
  contactEmail: string;
  source: string; // e.g. 'LinkedIn', 'Referral', 'Inbound'
  qualificationStatus: 'UNQUALIFIED' | 'QUALIFIED' | 'DISQUALIFIED';
  score: number; // 0-100
  notes: string;
}

export interface AccountArtifact extends BaseArtifact {
  type: 'AccountArtifact';
  companyName: string;
  industry: string;
  annualRevenue: number;
  employeeCount: number;
  primaryContact: string;
  website: string;
  address: string;
}

export interface OpportunityArtifact extends BaseArtifact {
  type: 'OpportunityArtifact';
  accountId: string;
  title: string;
  stage: 'DISCOVERY' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
  value: number;
  currency: string;
  closeDate: string;
  probability: number; // 0-100
  // BANT Fields
  budget: string;
  authority: string;
  need: string;
  timeline: string;
  nextAction: string;
}

export interface ProposalArtifact extends BaseArtifact {
  type: 'ProposalArtifact';
  opportunityId: string;
  title: string;
  executiveSummary: string;
  scope: string[];
  pricing: Array<{ item: string; quantity: number; unitPrice: number }>;
  totalValue: number;
  discountPercentage: number;
  validUntil: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED';
}
