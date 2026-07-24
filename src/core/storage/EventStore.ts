import { storageEngine } from './StorageEngine';
import { eventBus } from '../runtime/EventBus';

export interface SyncEvent {
  id?: number;
  eventType: string; // e.g. 'activity_created', 'contact_updated'
  payload: any;
  providerId: string;
  createdAt: number;
}

export class EventStore {
  
  public async append(eventType: string, payload: any, providerId: string): Promise<number> {
    const db = storageEngine.getAdapter();
    const event: SyncEvent = {
      eventType,
      payload: JSON.stringify(payload),
      providerId,
      createdAt: Date.now()
    };
    
    const id = await db.insert('event_log', {
      event_type: event.eventType,
      payload: event.payload,
      provider_id: event.providerId,
      created_at: event.createdAt
    });
    
    console.log(`[EventStore] Appended event ${eventType} (ID: ${id})`);
    
    // Broadcast via memory bus for real-time reactivity
    eventBus.publish('chatr:store-event', { id, eventType, payload, providerId }, 'EventStore');
    
    return id as number;
  }
  
  public async replay(fromId: number = 0, callback: (event: SyncEvent) => Promise<void>): Promise<void> {
    const db = storageEngine.getAdapter();
    const rows = await db.query('SELECT * FROM event_log WHERE id > ? ORDER BY id ASC', [fromId]);
    
    for (const row of rows) {
      await callback({
        id: row.id,
        eventType: row.event_type,
        payload: JSON.parse(row.payload),
        providerId: row.provider_id,
        createdAt: row.created_at
      });
    }
  }

  public async getRecentEvents(limit: number = 10): Promise<SyncEvent[]> {
    const db = storageEngine.getAdapter();
    const rows = await db.query('SELECT * FROM event_log ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload),
      providerId: row.provider_id,
      createdAt: row.created_at
    }));
  }

  public async searchEvents(query: string, limit: number = 20): Promise<SyncEvent[]> {
    const db = storageEngine.getAdapter();
    const likeQuery = `%${query}%`;
    const rows = await db.query(
      'SELECT * FROM event_log WHERE payload LIKE ? OR event_type LIKE ? ORDER BY created_at DESC LIMIT ?', 
      [likeQuery, likeQuery, limit]
    );
    return rows.map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload),
      providerId: row.provider_id,
      createdAt: row.created_at
    }));
  }

  public async getIntelligenceBrief(): Promise<any> {
    const db = storageEngine.getAdapter();
    const emailCount = await db.query("SELECT COUNT(*) as c FROM event_log WHERE event_type = 'email'");
    const docCount = await db.query("SELECT COUNT(*) as c FROM event_log WHERE event_type = 'document' OR payload LIKE '%contract%'");
    const invoiceCount = await db.query("SELECT COUNT(*) as c FROM event_log WHERE payload LIKE '%invoice%'");
    const meetingCount = await db.query("SELECT COUNT(*) as c FROM event_log WHERE event_type = 'meeting'");

    const e = (emailCount[0] as any)?.c || 0;
    const d = (docCount[0] as any)?.c || 0;
    const i = (invoiceCount[0] as any)?.c || 0;
    const m = (meetingCount[0] as any)?.c || 0;

    const actions = [];
    if (d > 0) actions.push({ label: 'Review Contracts', action: 'review_contracts' });
    if (e > 0) actions.push({ label: 'Clear Inbox', action: 'clear_inbox' });
    if (i > 0) actions.push({ label: 'Approve Invoices', action: 'approve_invoices' });
    if (actions.length === 0) actions.push({ label: 'Draft Update', action: 'draft_update' });

    return {
      metrics: {
        emails: e,
        contracts: d,
        invoices: i,
        meetings: m
      },
      actions: actions.slice(0, 3)
    };
  }
}

export const eventStore = new EventStore();
