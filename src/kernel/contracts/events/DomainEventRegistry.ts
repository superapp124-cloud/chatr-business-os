/**
 * Domain Event Registry
 * 
 * Centralized, canonical vocabulary for all events in the enterprise.
 * The Event Store is domain-agnostic, but the Registry ensures EDL, Studio,
 * AI, and Analytics all reference the exact same concepts.
 */

export enum CoreDomainEvents {
  // Primitives
  LivingObjectCreated = 'LivingObjectCreated',
  LivingObjectUpdated = 'LivingObjectUpdated',
  LivingObjectArchived = 'LivingObjectArchived',
  LivingObjectRestored = 'LivingObjectRestored',
  
  // Relationships
  RelationshipCreated = 'RelationshipCreated',
  RelationshipRemoved = 'RelationshipRemoved',
  
  // Correction
  CorrectionApplied = 'CorrectionApplied'
}

export enum RecruitmentEvents {
  CandidateCreated = 'CandidateCreated',
  CandidateScreeningStarted = 'CandidateScreeningStarted',
  CandidateBackgroundCheckPassed = 'CandidateBackgroundCheckPassed',
  CandidateOffered = 'CandidateOffered',
  CandidateHired = 'CandidateHired',
  CandidateRejected = 'CandidateRejected'
}

export enum ITAssetEvents {
  AssetCreated = 'AssetCreated',
  AssetAssigned = 'AssetAssigned',
  AssetReturned = 'AssetReturned',
  AssetRepairStarted = 'AssetRepairStarted',
  AssetRetired = 'AssetRetired'
}

// Global union of all permitted event types in the system
export type DomainEventType = 
  | CoreDomainEvents 
  | RecruitmentEvents 
  | ITAssetEvents 
  | string; // Fallback for dynamic capability events
