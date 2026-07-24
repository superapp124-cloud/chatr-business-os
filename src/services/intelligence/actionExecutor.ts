/**
 * CHATR Intelligence Engine – Action Executor
 * 
 * Handles execution of AI suggested actions (e.g., blocking, reporting, deep linking).
 */

import type { AISuggestedAction } from './schema';
import { db } from './repository';
import { Capacitor } from '@capacitor/core';
import { intelligenceBus } from './eventBus';

export class ActionExecutor {
  /**
   * Executes an AI-suggested action and updates the event graph if necessary.
   */
  async execute(action: AISuggestedAction): Promise<void> {
    console.info(`[ActionExecutor] Executing action: ${action.type}`, action);

    try {
      switch (action.type) {
        case 'block':
          await this.handleBlock(action);
          break;
        case 'report':
          await this.handleReport(action);
          break;
        case 'pay':
        case 'track':
        case 'navigate':
          await this.handleDeepLink(action);
          break;
        case 'add_to_calendar':
          await this.handleAddToCalendar(action);
          break;
        case 'learn_why':
          this.handleLearnWhy(action);
          break;
        case 'reply':
        case 'remind':
          console.info(`[ActionExecutor] Action ${action.type} handled natively by UI or OS intent.`);
          break;
        default:
          console.warn(`[ActionExecutor] Unrecognized action type: ${action.type}`);
      }
    } catch (err) {
      console.error(`[ActionExecutor] Failed to execute action ${action.type}:`, err);
      throw err;
    }
  }

  private async handleBlock(action: AISuggestedAction) {
    const eventId = action.payload?.eventId as string | undefined;
    if (!eventId) return;

    // Phase 4: Identify the sender and mark them as blocked in the Graph
    const event = await db.queryEvents({ limit: 1 }).then(res => res.find(e => e.id === eventId));
    if (!event) return;

    const entity = await db.findEntityByAlias(event.sender.canonical ?? event.sender.raw);
    if (entity) {
      const rel = await db.getRelationship(entity.id);
      if (rel) {
        rel.riskLevel = 'high';
        rel.trustScore = 0;
        await db.saveRelationship(rel);
        
        // Notify the bus so UI and other plugins (like ChatrShield) can react
        intelligenceBus.emit('threat:detected', {
          event,
          threat: {
            detected: true,
            type: 'manual_block',
            riskScore: 1.0,
            confidence: 1.0,
            explanation: 'User manually blocked this contact.',
            recommendedAction: 'block'
          }
        });
      }
    }
  }

  private async handleReport(action: AISuggestedAction) {
    // Similar to block, but might push telemetry to a centralized spam service later
    await this.handleBlock(action);
    console.info('[ActionExecutor] Reported event to ChatrShield telemetry.');
  }

  private async handleDeepLink(action: AISuggestedAction) {
    // Maps actions to internal mini-apps
    const paths: Record<string, string> = {
      pay: '#/wallet',
      track: '#/marketplace/orders',
      navigate: '#/maps'
    };

    const path = paths[action.type];
    if (path) {
      window.location.hash = path;
    }
  }

  private async handleAddToCalendar(action: AISuggestedAction) {
    if (Capacitor.isNativePlatform()) {
      // In Phase 5/6, we'd invoke the native Calendar plugin here.
      // e.g. await Calendar.createEvent(...)
      console.info('[ActionExecutor] Native calendar plugin invoked (Stub).');
    } else {
      console.info('[ActionExecutor] Calendar intent (Web fallback).');
      window.open('https://calendar.google.com/calendar/render?action=TEMPLATE', '_blank');
    }
  }

  private handleLearnWhy(action: AISuggestedAction) {
    // For now, handled entirely in UI by showing an alert. 
    // This is just a no-op fallback if called directly.
    const explanation = action.payload?.explanation as string | undefined;
    if (explanation) {
      alert(`AI Reasoning: ${explanation}`);
    }
  }
}

export const actionExecutor = new ActionExecutor();
