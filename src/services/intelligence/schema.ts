/**
 * CHATR Intelligence Engine – Canonical Communication Schema
 *
 * Every plugin (SMS, Mail, Calls, Notifications, Voicemail) must emit
 * a CommunicationEvent that conforms to this schema before entering
 * the Intelligence pipeline. This is the single source of truth.
 *
 * Decision: Defined upfront so all future modules share the same
 * contract and no data migrations are needed when adding new sources.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Source Identifiers
// ─────────────────────────────────────────────────────────────────────────────

export type CommunicationSource =
  | 'sms'
  | 'call'
  | 'mail'
  | 'notification'
  | 'voicemail'
  | 'document'
  | 'browser'
  | 'wallet'
  | 'health'
  | 'unknown';

export type CommunicationDirection = 'inbound' | 'outbound' | 'missed' | 'unknown';

export type CommunicationStatus =
  | 'received'
  | 'read'
  | 'replied'
  | 'archived'
  | 'deleted'
  | 'pending'
  | 'failed';

// ─────────────────────────────────────────────────────────────────────────────
// Entity Types (Decision 5 – multi-root graph)
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType =
  | 'person'
  | 'organization'
  | 'phone_number'
  | 'email_address'
  | 'conversation'
  | 'communication'
  | 'document'
  | 'invoice'
  | 'meeting'
  | 'task'
  | 'location'
  | 'url'
  | 'product'
  | 'amount';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  /** Normalized canonical form, e.g. E.164 phone, lowercase email */
  canonical?: string;
  confidence: number;
  /** Character offset in the content string */
  span?: { start: number; end: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Results (Decision 8 – unified pipeline output)
// ─────────────────────────────────────────────────────────────────────────────

export type ThreatType =
  | 'spam'
  | 'phishing'
  | 'caller_spoofing'
  | 'fake_domain'
  | 'otp_theft'
  | 'invoice_fraud'
  | 'bec'            // Business Email Compromise
  | 'scam_sms'
  | 'malicious_url'
  | 'qr_attack'
  | 'apk_distribution'
  | 'none';

export interface ThreatResult {
  detected: boolean;
  type: ThreatType;
  /** 0–1 */
  riskScore: number;
  /** 0–1 */
  confidence: number;
  explanation: string;
  recommendedAction: 'block' | 'warn' | 'review' | 'allow';
}

export type CommunicationCategory =
  | 'personal'
  | 'work'
  | 'finance'
  | 'delivery'
  | 'travel'
  | 'health'
  | 'promotion'
  | 'otp'
  | 'alert'
  | 'social'
  | 'news'
  | 'unknown';

/** Multi-dimensional attention (Decision 9) */
export interface AttentionScore {
  /** Composite 0–100 */
  overall: number;
  urgency: number;
  importance: number;
  securityRisk: number;
  financialImpact: number;
  replyNeeded: boolean;
  timeSensitivity: number;
  relationshipWeight: number;
}

/** Explainable AI reasons (Decision 10) */
export interface AIExplanation {
  summary: string;
  reasons: string[];
  estimatedReadingTimeSeconds: number;
}

export interface AISuggestedAction {
  id: string;
  label: string;
  type:
    | 'pay'
    | 'reply'
    | 'track'
    | 'download'
    | 'block'
    | 'report'
    | 'archive'
    | 'add_to_calendar'
    | 'call'
    | 'navigate'
    | 'remind'
    | 'share'
    | 'delete'
    | 'learn_why';
  /** Payload forwarded to the action handler */
  payload?: Record<string, unknown>;
  confidence: number;
}

export interface AIResults {
  /** Raw one-line summary */
  summary?: string;
  category: CommunicationCategory;
  attention: AttentionScore;
  threat: ThreatResult;
  entities: ExtractedEntity[];
  suggestedActions: AISuggestedAction[];
  explanation: AIExplanation;
  /** Processing mode used for this event */
  processedBy: 'local' | 'cloud' | 'none';
  /** Milliseconds the pipeline took */
  processingMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sender / Recipient
// ─────────────────────────────────────────────────────────────────────────────

export interface CommunicationParty {
  /** Raw identifier as received (phone number, email, SIP URI, etc.) */
  raw: string;
  /** Canonical resolved form */
  canonical?: string;
  /** Display name resolved from local contacts */
  displayName?: string;
  /** Resolved entity id in the communication graph */
  entityId?: string;
  verified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachment
// ─────────────────────────────────────────────────────────────────────────────

export interface CommunicationAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Local on-device path if downloaded */
  localPath?: string;
  /** URL if available (not sent to cloud AI unless user explicitly approves) */
  url?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical CommunicationEvent (the heart of the system)
// ─────────────────────────────────────────────────────────────────────────────

export interface CommunicationEvent {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Globally unique, deterministic ID generated by the plugin */
  id: string;
  /** Which plugin produced this event */
  source: CommunicationSource;
  /** External provider ID (Gmail message id, SMS row id, …) */
  externalId?: string;
  direction: CommunicationDirection;
  status: CommunicationStatus;

  // ── Parties ───────────────────────────────────────────────────────────────
  sender: CommunicationParty;
  recipients: CommunicationParty[];

  // ── Timing ────────────────────────────────────────────────────────────────
  /** When the communication actually happened */
  timestamp: string;           // ISO 8601
  /** When CHATR ingested it */
  ingestedAt: string;          // ISO 8601
  /** Duration in seconds (calls, voicemail) */
  durationSeconds?: number;

  // ── Content ───────────────────────────────────────────────────────────────
  subject?: string;
  /** Plain-text body (HTML stripped) */
  content: string;
  /** Raw HTML or rich content – stored separately, never sent to cloud by default */
  richContent?: string;
  attachments: CommunicationAttachment[];
  threadId?: string;

  // ── Graph Links ───────────────────────────────────────────────────────────
  /** IDs of graph entities this event is linked to */
  linkedEntityIds: string[];
  /** Related prior events (e.g. replies in a thread) */
  relatedEventIds: string[];

  // ── Source-specific extra data ────────────────────────────────────────────
  metadata: Record<string, unknown>;

  // ── AI Results ────────────────────────────────────────────────────────────
  /** Populated by the Intelligence pipeline after ingest */
  aiResults?: AIResults;

  // ── Indexing flags ────────────────────────────────────────────────────────
  isIndexed: boolean;
  isProcessed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication Graph – Entity Node
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphEntity {
  id: string;
  type: EntityType;
  /** Display label */
  label: string;
  /** All known aliases / raw identifiers */
  aliases: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relationship Intelligence (Module 2)
// ─────────────────────────────────────────────────────────────────────────────

export interface RelationshipProfile {
  entityId: string;
  /** 'personal' | 'work' | 'unknown' */
  relationshipType: 'personal' | 'work' | 'service' | 'unknown';
  verified: boolean;
  communicationFrequency: number;   // events per week, rolling 30d
  lastInteractionAt?: string;       // ISO 8601
  avgReplyTimeSeconds?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  /** 0–100 */
  trustScore: number;
  knownOrganization?: string;
  conversationSummary?: string;
  updatedAt: string;
}
