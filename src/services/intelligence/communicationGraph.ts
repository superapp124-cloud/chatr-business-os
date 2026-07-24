/**
 * CHATR Intelligence Engine – Communication Graph
 *
 * Decision 5: Multi-root entity graph (Person, Organization,
 * PhoneNumber, Email, Invoice, Meeting, Task, …).
 *
 * Responsibilities:
 *  - Resolve an incoming CommunicationParty to a GraphEntity
 *    (creating a new one if unknown, merging if alias matches).
 *  - Link events to their sender / recipient entities.
 *  - Update RelationshipProfiles after each interaction.
 *  - Expose helpers to query a contact's unified timeline.
 */

import { db } from './repository';
import type {
  CommunicationEvent,
  CommunicationParty,
  GraphEntity,
  RelationshipProfile,
  EntityType,
} from './schema';

/** Uses Web Crypto API – available in all modern browsers, Capacitor, Node 15+. No package needed. */
function randomId(): string {
  return crypto.randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\+91/, '');
}

function inferEntityType(raw: string): EntityType {
  if (/^[\w._%+-]+@[\w.-]+\.[a-z]{2,}$/i.test(raw)) return 'email_address';
  if (/^[+\d\s()-]{7,15}$/.test(raw)) return 'phone_number';
  return 'person';
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication Graph
// ─────────────────────────────────────────────────────────────────────────────

export class CommunicationGraph {
  /**
   * Resolve a CommunicationParty to a GraphEntity.
   * Looks up by all known aliases; creates a new entity if none match.
   */
  async resolveEntity(party: CommunicationParty): Promise<GraphEntity> {
    const candidates = [
      party.canonical ?? '',
      normalize(party.raw),
    ].filter(Boolean);

    // Try to find existing entity by any alias
    for (const alias of candidates) {
      const existing = await db.findEntityByAlias(alias);
      if (existing) {
        // Merge in any new aliases / display name
        let changed = false;
        if (party.displayName && !existing.aliases.includes(party.displayName)) {
          existing.aliases.push(party.displayName);
          changed = true;
        }
        if (changed) {
          existing.updatedAt = new Date().toISOString();
          await db.saveEntity(existing);
        }
        return existing;
      }
    }

    // Create new entity
    const type = inferEntityType(party.raw);
    const entity: GraphEntity = {
      id: randomId(),
      type,
      label: party.displayName ?? party.canonical ?? party.raw,
      aliases: [...candidates, ...(party.displayName ? [party.displayName] : [])],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveEntity(entity);
    return entity;
  }

  /**
   * Link an event to its sender entity and update the relationship profile.
   */
  async processEvent(event: CommunicationEvent): Promise<void> {
    // Resolve sender
    const senderEntity = await this.resolveEntity(event.sender);
    event.sender.entityId = senderEntity.id;
    await db.linkEventToEntity(event.id, senderEntity.id);

    // Resolve recipients
    for (const recipient of event.recipients) {
      const recipientEntity = await this.resolveEntity(recipient);
      recipient.entityId = recipientEntity.id;
      await db.linkEventToEntity(event.id, recipientEntity.id);
    }

    // Update relationship profile for sender
    await this.updateRelationshipProfile(senderEntity, event);
  }

  /**
   * Update or create a RelationshipProfile after a new interaction.
   */
  private async updateRelationshipProfile(
    entity: GraphEntity,
    event: CommunicationEvent
  ): Promise<void> {
    const now = new Date().toISOString();
    const existing = await db.getRelationship(entity.id);

    if (existing) {
      existing.communicationFrequency = existing.communicationFrequency + 0.1;
      existing.lastInteractionAt = event.timestamp;
      existing.updatedAt = now;

      if (event.aiResults?.threat.detected) {
        const threatScore = event.aiResults.threat.riskScore;
        if (threatScore > 0.80) existing.riskLevel = 'high';
        else if (threatScore > 0.50) existing.riskLevel = 'medium';
        existing.trustScore = Math.max(0, existing.trustScore - threatScore * 20);
      }

      await db.saveRelationship(existing);
    } else {
      const newProfile: RelationshipProfile = {
        entityId: entity.id,
        relationshipType: 'unknown',
        verified: false,
        communicationFrequency: 1,
        lastInteractionAt: event.timestamp,
        riskLevel: event.aiResults?.threat.detected ? 'high' : 'unknown',
        trustScore: event.aiResults?.threat.detected ? 30 : 60,
        updatedAt: now,
      };
      await db.saveRelationship(newProfile);
    }
  }

  /**
   * Get all events associated with a specific entity (unified timeline view).
   */
  async getEntityTimeline(entityId: string, limit = 50): Promise<CommunicationEvent[]> {
    return db.queryEvents({ entityId, limit, orderBy: 'timestamp', orderDir: 'desc' });
  }

  /**
   * Search for an entity by name, phone, or email.
   */
  async findEntity(query: string): Promise<GraphEntity | null> {
    return db.findEntityByAlias(normalize(query));
  }

  /**
   * Get the relationship profile for an entity.
   */
  async getRelationship(entityId: string): Promise<RelationshipProfile | null> {
    return db.getRelationship(entityId);
  }
}

export const communicationGraph = new CommunicationGraph();
