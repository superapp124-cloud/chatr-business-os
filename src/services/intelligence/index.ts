/**
 * CHATR Intelligence Engine – Public API
 *
 * Single import point for all consumers.
 * Nothing in the UI layer should import from sub-modules directly.
 */

export { intelligenceEngine } from './engine';
export { intelligenceBus } from './eventBus';
export { communicationGraph } from './communicationGraph';
export { db as intelligenceDb } from './repository';
export { localAIPipeline } from './localPipeline';

// Types
export type {
  CommunicationEvent,
  CommunicationSource,
  CommunicationCategory,
  CommunicationParty,
  CommunicationAttachment,
  CommunicationDirection,
  CommunicationStatus,
  EntityType,
  ExtractedEntity,
  GraphEntity,
  RelationshipProfile,
  AIResults,
  AIExplanation,
  AISuggestedAction,
  AttentionScore,
  ThreatResult,
  ThreatType,
} from './schema';

export type {
  ICommunicationProvider,
  IStorageProvider,
  ISearchProvider,
  IAIProvider,
  IThreatProvider,
  PluginCapabilities,
  PluginStatus,
  SearchResult,
  StorageQueryOptions,
  StorageSearchOptions,
} from './providers';

export type {
  IntelligenceEventMap,
  IntelligenceTopic,
} from './eventBus';
