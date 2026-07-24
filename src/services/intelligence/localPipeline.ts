/**
 * CHATR Intelligence Engine – Local AI Pipeline
 *
 * Decision 8: One unified pipeline processes every communication event.
 * Decision 9: Multi-dimensional attention scoring (not a single number).
 * Decision 10: Every decision ships with an explanation.
 * Decision 11: Cloud AI never runs automatically – local is always the default.
 *
 * Pipeline stages (in order):
 *  1. Normalise   – clean text, resolve sender
 *  2. Threat      – spam / phishing / spoofing / scam detection
 *  3. Classify    – category, language, topic
 *  4. Extract     – entities (people, amounts, dates, URLs)
 *  5. Relationship Link – score against known contacts
 *  6. Attention   – compute multi-dimensional priority
 *  7. Actions     – generate contextual suggested actions
 *  8. Explain     – build the human-readable reasoning block
 */

import type {
  CommunicationEvent,
  AIResults,
  ThreatResult,
  ThreatType,
  AttentionScore,
  AISuggestedAction,
  AIExplanation,
  ExtractedEntity,
  CommunicationCategory,
} from './schema';
import type { IAIProvider } from './providers';
import { db } from './repository';

// ─────────────────────────────────────────────────────────────────────────────
// Threat Heuristics (Phase 1 – rule-based, no ML needed)
// ─────────────────────────────────────────────────────────────────────────────

const PHISHING_PATTERNS = [
  /verify.{0,30}(account|password|login|otp)/i,
  /click.{0,20}link.{0,20}(24|48|72)\s*h/i,
  /urgent.{0,30}action\s*required/i,
  /your\s+(account|card).{0,30}(suspended|blocked|locked)/i,
  /confirm\s+your\s+(identity|details)/i,
  /KYC\s+(expired|required|mandatory)/i,
  /update.{0,30}payment.{0,30}info/i, // modern smishing
];

const SCAM_PATTERNS = [
  /won\s+(a\s+)?(prize|lottery|gift)/i,
  /\bcongratulations\b.{0,40}\bwinner\b/i,
  /send\s+(₹|rs\.?|inr)\s*\d+.{0,30}claim/i,
  /loan\s+approved.{0,30}(no\s+collateral|instant)/i,
  /part.time\s+job.{0,30}earn/i, // job scam
  /\bwork\s+from\s+home.{0,30}whatsapp/i, // whatsapp task scam
];

const OTP_PATTERNS = [
  /\b(otp|one.time.password)\b/i,
  /\b\d{4,8}\b.{0,20}(is\s+your|don't\s+share)/i,
  /never\s+share\s+this\s+code/i,
];

const FAKE_DOMAIN_PATTERNS = [
  /(amaz[o0]n|paypa[l1]|g[o0][o0]g[l1]e|netfl[i1]x)\./i,
  /\.(xyz|top|click|loan|review|win)\//i,
  /bit\.ly|tinyurl\.com/i, // shorteners often used in smishing
];

function detectThreat(event: CommunicationEvent): ThreatResult {
  const text = `${event.subject ?? ''} ${event.content}`;
  let type: ThreatType = 'none';
  let riskScore = 0;
  const reasons: string[] = [];

  for (const p of PHISHING_PATTERNS) {
    if (p.test(text)) { type = 'phishing'; riskScore = Math.max(riskScore, 0.85); reasons.push('phishing language detected'); break; }
  }
  for (const p of SCAM_PATTERNS) {
    if (p.test(text)) { type = 'scam_sms'; riskScore = Math.max(riskScore, 0.80); reasons.push('scam language detected'); break; }
  }
  for (const p of OTP_PATTERNS) {
    if (p.test(text)) { type = 'otp_theft'; riskScore = Math.max(riskScore, 0.70); reasons.push('OTP sharing request detected'); break; }
  }
  for (const p of FAKE_DOMAIN_PATTERNS) {
    if (p.test(text)) { type = type !== 'none' ? type : 'fake_domain'; riskScore = Math.max(riskScore, 0.75); reasons.push('suspicious domain detected'); break; }
  }

  const detected = riskScore > 0;
  return {
    detected,
    type,
    riskScore,
    confidence: detected ? 0.80 : 0.95,
    explanation: detected ? reasons.join('; ') : 'No threats detected',
    recommendedAction: riskScore >= 0.80 ? 'block' : riskScore >= 0.60 ? 'warn' : riskScore > 0 ? 'review' : 'allow',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Classification (rule-based)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_RULES: [CommunicationCategory, RegExp][] = [
  ['finance',    /(invoice|payment|bill|₹|rs\.?\s*\d|inr|bank|credit\s*card|emi|due\s+date)/i],
  ['delivery',   /(shipped|delivered|out\s*for\s*delivery|your\s*order|tracking\s*(number|id))/i],
  ['travel',     /(flight|pnr|boarding\s*pass|check.?in|hotel|reservation|itinerary)/i],
  ['health',     /(appointment|prescription|doctor|hospital|clinic|report|diagnosis)/i],
  ['otp',        /\b(otp|one.time.password|verification\s*code)\b/i],
  ['promotion',  /(sale|offer|discount|off|coupon|deal|promo|exclusive)/i],
  ['alert',      /(alert|warning|security|suspicious|detected|blocked|unauthorized)/i],
  ['social',     /(liked|commented|followed|mentioned|tagged|shared|post)/i],
  ['work',       /(meeting|agenda|deadline|project|standup|sprint|approval|sign\s*off)/i],
];

function classify(text: string): CommunicationCategory {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(text)) return cat;
  }
  return 'personal';
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Extraction (rule-based, Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

function extractEntities(event: CommunicationEvent): ExtractedEntity[] {
  const text = `${event.subject ?? ''} ${event.content}`;
  const entities: ExtractedEntity[] = [];
  const now = new Date();

  // Phone numbers (Indian + international)
  const phoneRe = /(\+?91[-\s]?)?[6-9]\d{9}/g;
  let m: RegExpExecArray | null;
  while ((m = phoneRe.exec(text)) !== null) {
    entities.push({ type: 'phone_number', value: m[0], canonical: m[0].replace(/\D/g, ''), confidence: 0.90, span: { start: m.index, end: m.index + m[0].length } });
  }

  // Email addresses
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((m = emailRe.exec(text)) !== null) {
    entities.push({ type: 'email_address', value: m[0], canonical: m[0].toLowerCase(), confidence: 0.95, span: { start: m.index, end: m.index + m[0].length } });
  }

  // Amounts (₹ or Rs or INR)
  const amountRe = /(₹|Rs\.?\s*|INR\s*)(\d[\d,]*(\.\d{1,2})?)/gi;
  while ((m = amountRe.exec(text)) !== null) {
    entities.push({ type: 'amount', value: m[0], canonical: m[2].replace(',', ''), confidence: 0.88 });
  }

  // URLs
  const urlRe = /https?:\/\/[^\s<>"]+/g;
  while ((m = urlRe.exec(text)) !== null) {
    entities.push({ type: 'url', value: m[0], confidence: 0.99, span: { start: m.index, end: m.index + m[0].length } });
  }

  return entities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attention Scoring (Decision 9 – multi-dimensional)
// ─────────────────────────────────────────────────────────────────────────────

async function scoreAttention(
  event: CommunicationEvent,
  threat: ThreatResult,
  category: CommunicationCategory
): Promise<AttentionScore> {
  const text = `${event.subject ?? ''} ${event.content}`.toLowerCase();

  const urgency      = /urgent|asap|immediately|now|today|expire/i.test(text) ? 80 : 40;
  const importance   = ['finance', 'work', 'health', 'alert'].includes(category) ? 75 : 40;
  const securityRisk = Math.round(threat.riskScore * 100);
  const financialImpact = category === 'finance' ? 70 : 20;
  const replyNeeded  = /please\s+(reply|respond|confirm|let\s+me\s+know|call\s+back)/i.test(text)
    || event.direction === 'inbound';
  const timeSensitivity = /\b(today|tomorrow|this\s+week|expires|deadline)\b/i.test(text) ? 75 : 30;

  // Relationship weight from stored profile
  let relationshipWeight = 50;
  const entity = await db.findEntityByAlias(event.sender.raw);
  if (entity) {
    const rel = await db.getRelationship(entity.id);
    if (rel) {
      relationshipWeight = rel.trustScore;
    }
  }

  // Phase 4: Exponential Time Decay (half-life of ~48 hours for urgency)
  const ageMs = Date.now() - new Date(event.timestamp).getTime();
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));
  const decayFactor = Math.exp(-0.0144 * ageHours); // approx 0.5 at 48 hours

  const decayedUrgency = Math.round(urgency * decayFactor);
  const decayedTimeSensitivity = Math.round(timeSensitivity * decayFactor);

  const overall = Math.min(
    100,
    Math.round(
      decayedUrgency * 0.20 +
      importance * 0.20 +
      securityRisk * 0.20 +
      financialImpact * 0.15 +
      (replyNeeded ? 60 : 0) * 0.15 +
      decayedTimeSensitivity * 0.10
    )
  );

  return {
    overall,
    urgency: decayedUrgency,
    importance,
    securityRisk,
    financialImpact,
    replyNeeded,
    timeSensitivity: decayedTimeSensitivity,
    relationshipWeight,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Generation (Decision 7 – dynamic, not hardcoded)
// ─────────────────────────────────────────────────────────────────────────────

function generateActions(
  event: CommunicationEvent,
  category: CommunicationCategory,
  threat: ThreatResult
): AISuggestedAction[] {
  const actions: AISuggestedAction[] = [];

  if (threat.detected) {
    actions.push(
      { id: 'block',      label: 'Block',      type: 'block',     confidence: 0.90, payload: { eventId: event.id } },
      { id: 'report',     label: 'Report',     type: 'report',    confidence: 0.85, payload: { eventId: event.id } },
      { id: 'learn_why',  label: 'Learn Why',  type: 'learn_why', confidence: 1.00, payload: { explanation: threat.explanation } }
    );
    return actions;
  }

  if (category === 'finance') {
    actions.push({ id: 'pay',    label: 'Pay Now',  type: 'pay',    confidence: 0.80, payload: { eventId: event.id } });
    actions.push({ id: 'remind', label: 'Remind Me', type: 'remind', confidence: 0.85, payload: { eventId: event.id } });
  }
  if (category === 'delivery') {
    actions.push({ id: 'track', label: 'Track',  type: 'track', confidence: 0.90, payload: { eventId: event.id } });
  }
  if (category === 'travel') {
    actions.push({ id: 'calendar', label: 'Add to Calendar', type: 'add_to_calendar', confidence: 0.85 });
    actions.push({ id: 'navigate', label: 'Navigate',        type: 'navigate',        confidence: 0.75 });
  }
  if (category === 'work') {
    actions.push({ id: 'reply',    label: 'Reply',            type: 'reply',           confidence: 0.80 });
    actions.push({ id: 'calendar', label: 'Add to Calendar', type: 'add_to_calendar', confidence: 0.75 });
  }
  if (event.direction === 'inbound') {
    actions.push({ id: 'reply',  label: 'Reply',   type: 'reply',   confidence: 0.70 });
  }

  return actions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Explanation Builder (Decision 10 – always explainable)
// ─────────────────────────────────────────────────────────────────────────────

function buildExplanation(
  category: CommunicationCategory,
  attention: AttentionScore,
  threat: ThreatResult
): AIExplanation {
  const reasons: string[] = [];

  if (threat.detected) reasons.push(`⚠️ ${threat.explanation}`);
  if (attention.replyNeeded) reasons.push('Sender is expecting a reply');
  if (attention.financialImpact > 50) reasons.push('Contains a financial transaction');
  if (attention.urgency > 70) reasons.push('Marked as urgent');
  if (attention.timeSensitivity > 70) reasons.push('Time-sensitive deadline detected');
  if (attention.relationshipWeight > 70) reasons.push('From a trusted, frequent contact');

  const wordCount = 20; // simplified estimate for Phase 1
  const readingTimeSecs = Math.max(5, Math.ceil(wordCount / 3));

  return {
    summary: `${category.charAt(0).toUpperCase() + category.slice(1)} – Priority ${attention.overall}/100`,
    reasons: reasons.length > 0 ? reasons : ['No special signals detected'],
    estimatedReadingTimeSeconds: readingTimeSecs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Pipeline (Decision 8 – identical flow for all sources)
// ─────────────────────────────────────────────────────────────────────────────

export class LocalAIPipeline implements IAIProvider {
  readonly mode = 'local' as const;
  readonly isAvailable = true;

  async process(event: CommunicationEvent): Promise<AIResults> {
    const startMs = Date.now();
    const text = `${event.subject ?? ''} ${event.content}`;

    // Stage 1 – Threat Detection
    const threat = detectThreat(event);

    // Stage 2 – Classification
    const category = classify(text);

    // Stage 3 – Entity Extraction
    const entities = extractEntities(event);

    // Stage 4 – Attention Scoring (async, checks relationship DB)
    const attention = await scoreAttention(event, threat, category);

    // Stage 5 – Action Generation
    const suggestedActions = generateActions(event, category, threat);

    // Stage 6 – Explanation
    const explanation = buildExplanation(category, attention, threat);

    return {
      summary: explanation.summary,
      category,
      attention,
      threat,
      entities,
      suggestedActions,
      explanation,
      processedBy: 'local',
      processingMs: Date.now() - startMs,
    };
  }
}

export const localAIPipeline = new LocalAIPipeline();
