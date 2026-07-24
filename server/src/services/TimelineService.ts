import { EventBus } from './EventBusService.js';
import { ISystemEvent } from '../types.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

class SystemTimelineRuntime {
  constructor() {
    // Listen to ALL events. The Timeline Runtime is greedy.
    EventBus.subscribe('*', this.handleEvent.bind(this));
  }

  private async handleEvent(event: ISystemEvent) {
    console.log(`[TimelineRuntime] Processing event for timeline: ${event.eventType}`);
    
    // We only care about events that are tied to a specific WorkObject
    const targetObjectId = event.payload?.targetObjectId || event.payload?.object?.id;
    if (!targetObjectId) return;

    // Construct the timeline entry
    const timelineEntry = {
      id: event.id || `tl_${Date.now()}`,
      eventType: event.eventType,
      source: event.source,
      actorId: event.actorId,
      timestamp: event.createdAt || new Date().toISOString(),
      summary: this.generateSummary(event)
    };

    try {
      // In a real high-scale system, timeline events are stored in a separate timeseries DB or a highly optimized table (os_timeline_entries)
      // For this phase, we append it to the metadata JSONB of the os_work_objects table to fulfill the UWO architecture
      
      const { data: wo } = await supabase
        .from('os_work_objects')
        .select('metadata')
        .eq('id', targetObjectId)
        .single();

      if (wo) {
        const metadata = wo.metadata || {};
        const timeline = metadata.timeline || [];
        
        timeline.push(timelineEntry);
        metadata.timeline = timeline;

        await supabase
          .from('os_work_objects')
          .update({ metadata })
          .eq('id', targetObjectId);
          
        console.log(`[TimelineRuntime] Appended ${event.eventType} to UWO ${targetObjectId} timeline.`);
      }
    } catch (err) {
      console.error(`[TimelineRuntime] Failed to update timeline for ${targetObjectId}`, err);
    }
  }

  private generateSummary(event: ISystemEvent): string {
    switch (event.eventType) {
      case 'WorkObjectCreated': return 'Record was created by Workflow Engine.';
      case 'ApprovalRequested': return 'Execution paused pending approval.';
      case 'ApprovalGranted': return 'Approval granted, workflow resumed.';
      case 'IntentResolved': return `AI resolved intent to action: ${event.payload.action}`;
      default: return `System Event: ${event.eventType}`;
    }
  }
}

export const TimelineRuntime = new SystemTimelineRuntime();
