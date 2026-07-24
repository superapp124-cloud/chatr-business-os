/**
 * CHATR OS — Knowledge Graph EventBus Consumer
 *
 * Subscribes to the EventBus and auto-indexes business entities into the
 * Knowledge Graph as they are created or updated.
 *
 * Evidence: This module closes the gap identified in the Production Evidence Report v1.0:
 * "indexLead() and indexDocument() exist but no EventBus subscriber wires them."
 *
 * Wired Events:
 *   WorkObjectCreated → indexLead (CRM.* capabilities)
 *   WorkObjectCreated → indexDocument (Document.* capabilities)
 *   WorkObjectCreated → generic node indexing
 */

import { EventBus } from '../../sdk/engines/EventBus';
import { knowledgeGraphIndexer } from './KnowledgeGraphIndexer';

let initialized = false;

/**
 * Call once at application startup (e.g. from KernelProvider or App.tsx).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initKnowledgeGraphConsumer(): void {
  if (initialized) return;
  initialized = true;

  // ── CRM: Lead Created ────────────────────────────────────────────────────────
  EventBus.subscribe('*', 'WorkObjectCreated', (payload: any) => {
    try {
      const { objectName, object, capabilityId } = payload ?? {};
      if (!object || !objectName) return;

      // CRM Lead → index as Person + Company edge
      if (
        capabilityId?.startsWith('CRM') ||
        objectName?.toLowerCase().includes('lead') ||
        objectName?.toLowerCase().includes('contact')
      ) {
        const name = object.Name || object.FullName || object.ContactName || object.LeadName || object.id;
        const company = object.Company || object.Organization || object.Account || '';
        knowledgeGraphIndexer.indexLead(object.id, name, company);
        console.debug(`[KnowledgeGraph] Indexed Lead → ${name} (${company})`);
      }

      // Document Upload → index as Document node
      if (
        capabilityId?.startsWith('Document') ||
        objectName?.toLowerCase().includes('document') ||
        objectName?.toLowerCase().includes('file') ||
        objectName?.toLowerCase().includes('attachment')
      ) {
        const fileName = object.FileName || object.Name || object.Title || object.id;
        const uploadedBy = object._createdBy || 'unknown';
        knowledgeGraphIndexer.indexDocument(object.id, fileName, uploadedBy);
        console.debug(`[KnowledgeGraph] Indexed Document → ${fileName}`);
      }
    } catch (e) {
      console.warn('[KnowledgeGraph Consumer] Error processing WorkObjectCreated:', e);
    }
  });

  // ── Formal Event Contracts: LeadCreated ─────────────────────────────────────
  EventBus.subscribe('*', 'LeadCreated', (payload: any) => {
    try {
      const { leadId, name, company } = payload ?? {};
      if (leadId && name) {
        knowledgeGraphIndexer.indexLead(leadId, name, company ?? '');
        console.debug(`[KnowledgeGraph] Indexed LeadCreated → ${name}`);
      }
    } catch (e) {
      console.warn('[KnowledgeGraph Consumer] Error processing LeadCreated:', e);
    }
  });

  // ── Formal Event Contracts: DocumentUploaded ─────────────────────────────────
  EventBus.subscribe('*', 'DocumentUploaded', (payload: any) => {
    try {
      const { documentId, fileName, uploadedBy } = payload ?? {};
      if (documentId && fileName) {
        knowledgeGraphIndexer.indexDocument(documentId, fileName, uploadedBy ?? 'unknown');
        console.debug(`[KnowledgeGraph] Indexed DocumentUploaded → ${fileName}`);
      }
    } catch (e) {
      console.warn('[KnowledgeGraph Consumer] Error processing DocumentUploaded:', e);
    }
  });

  // ── Formal Event Contracts: MeetingScheduled ──────────────────────────────
  EventBus.subscribe('*', 'MeetingScheduled', (payload: any) => {
    try {
      const { meetingId, title, attendeeIds } = payload ?? {};
      if (meetingId && title) {
        knowledgeGraphIndexer.indexMeeting(meetingId, title, attendeeIds ?? []);
        console.debug(`[KnowledgeGraph] Indexed MeetingScheduled → ${title}`);
      }
    } catch (e) {
      console.warn('[KnowledgeGraph Consumer] Error processing MeetingScheduled:', e);
    }
  });

  console.info('[KnowledgeGraph] Consumer initialized — subscribed to WorkObjectCreated, LeadCreated, DocumentUploaded, MeetingScheduled');
}
