/**
 * CHATR OS — Kernel Situation Assessment Runtime (SAR)
 * 
 * Pipeline: Business Events -> State Machines -> Policies -> Workflows -> SLA -> SAR
 * 
 * Its only job is to answer: What deserves this user's attention right now?
 * It generates priorities, not dashboards.
 */

import { BusinessObjectStore } from './BusinessObjectStore';
import { ICapabilityManifest } from '../types';

export interface IAttentionItem {
  id: string;
  capabilityId: string;
  objectName: string;
  recordId: string;
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  type: 'approval' | 'sla-breach' | 'bottleneck' | 'recommendation';
  actionLabel: string;
  timestamp: string;
}

export const SituationAssessmentRuntime = {
  /**
   * Scans all installed packages and their data to assess what needs attention.
   */
  assessCurrentSituation(): IAttentionItem[] {
    const items: IAttentionItem[] = [];
    const registry = (window as any).__CHATR_SDK_REGISTRY__ || {};

    for (const [capabilityId, sdk] of Object.entries(registry)) {
      const manifest = sdk as ICapabilityManifest;
      if (!manifest.objects) continue;

      for (const obj of manifest.objects) {
        const records = BusinessObjectStore.list(capabilityId, obj.name);
        
        for (const record of records) {
          // 1. Check for Pending Policies (Approvals)
          if (record._pendingPolicy) {
            items.push({
              id: `policy_${record.id}`,
              capabilityId,
              objectName: obj.name,
              recordId: record.id,
              title: `Approval Required: ${obj.name}`,
              description: `Policy ${record._pendingPolicy} triggered and is awaiting authorization.`,
              urgency: 'high',
              type: 'approval',
              actionLabel: 'Review & Approve',
              timestamp: record._updatedAt
            });
          }

          // 2. Check for SLA Breaches / Stagnant States
          // Simple heuristic: If a record has been in a non-terminal state for > 3 days (mocked as any record for demo)
          const statusField = obj.statusField || 'status';
          const status = record[statusField];
          
          if (status === 'Draft' || status === 'New' || status === 'Applied') {
             // In a real system we'd compare dates. We'll randomly flag 10% of new items for the demo.
             if (Math.random() > 0.8) {
               items.push({
                 id: `sla_${record.id}`,
                 capabilityId,
                 objectName: obj.name,
                 recordId: record.id,
                 title: `Stagnant ${obj.name}`,
                 description: `This ${obj.name.toLowerCase()} has been waiting for action.`,
                 urgency: 'medium',
                 type: 'bottleneck',
                 actionLabel: 'Take Action',
                 timestamp: record._updatedAt
               });
             }
          }
        }
      }
    }

    // Sort by urgency (mock implementation: critical > high > medium > low)
    const urgencyWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    return items.sort((a, b) => urgencyWeight[b.urgency] - urgencyWeight[a.urgency]);
  },

  /**
   * Generates the daily briefing based on the aggregated items.
   */
  generateBriefing(items: IAttentionItem[]) {
    const approvals = items.filter(i => i.type === 'approval').length;
    const breaches = items.filter(i => i.type === 'sla-breach').length;
    const bottlenecks = items.filter(i => i.type === 'bottleneck').length;

    const summary = [];
    if (approvals > 0) summary.push(`${approvals} decisions require your attention.`);
    if (breaches > 0) summary.push(`${breaches} SLA breaches detected.`);
    if (bottlenecks > 0) summary.push(`${bottlenecks} workflows are bottlenecked.`);
    if (summary.length === 0) summary.push(`All systems operating smoothly.`);

    return summary;
  },

  /**
   * Generates dynamic stats by parsing the _history log of all records.
   */
  getRecentActivity(hours: number = 24) {
    const registry = (window as any).__CHATR_SDK_REGISTRY__ || {};
    let totalChanges = 0;
    let recordsCreated = 0;
    let policiesTriggered = 0;
    let itemsCompleted = 0;

    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    for (const [capabilityId, sdk] of Object.entries(registry)) {
      const manifest = sdk as ICapabilityManifest;
      if (!manifest.objects) continue;

      for (const obj of manifest.objects) {
        const records = BusinessObjectStore.list(capabilityId, obj.name);
        for (const record of records) {
          if (record._history) {
            for (const event of record._history) {
              if (event.timestamp > threshold) {
                totalChanges++;
                if (event.action === 'CREATE') recordsCreated++;
                if (event.action === 'UPDATE' && event.details?.includes('Blocked by policy')) policiesTriggered++;
              }
            }
          }
          const statusField = obj.statusField || 'status';
          if (record[statusField] === 'Done' || record[statusField] === 'Closed') {
             if (record._updatedAt > threshold) {
               itemsCompleted++;
             }
          }
        }
      }
    }

    return { totalChanges, recordsCreated, policiesTriggered, itemsCompleted };
  }
};
