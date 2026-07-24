import { knowledgeGraph } from '../memory/KnowledgeGraph';
import { storageEngine } from '../storage/StorageEngine';

export interface TimelineEvent {
  id: string;
  type: string; // 'email', 'meeting', 'document'
  title: string;
  timestamp: number;
  participants: string[];
}

export class TimelineEngine {
  
  public async getIntentTimeline(intentSubjectId: string): Promise<TimelineEvent[]> {
    console.log(`[TimelineEngine] Generating Intent Timeline for: ${intentSubjectId}`);
    
    // 1. Traverse Graph to find all related entities
    // E.g. Intent "Hiring Engineer" -> Connected Emails, Calendar Events, Resumes
    const graphContext = await knowledgeGraph.traverse(intentSubjectId, 2);
    
    const entityIds = graphContext.nodes.map(n => n.id);
    
    // 2. Fetch rich metadata for these entities from the ActivityStore
    if (entityIds.length === 0) return [];

    const db = storageEngine.getAdapter();
    const placeholders = entityIds.map(() => '?').join(',');
    
    const activities = await db.query(
      `SELECT * FROM activities WHERE id IN (${placeholders}) ORDER BY timestamp ASC`,
      entityIds
    );

    // 3. Map to TimelineEvents
    return activities.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title || 'Untitled Event',
      timestamp: row.timestamp,
      participants: [] // In real implementation, extract from graph edges
    }));
  }
}

export const timelineEngine = new TimelineEngine();
