import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { Network } from '@capacitor/network';

interface PendingMessage {
  id: string; // client-generated UUID
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  media_url?: string;
  media_thumbnail_url?: string;
  retry_count: number;
  last_attempt: number;
  created_at: string;
}

interface MessageQueueDB extends DBSchema {
  pending_messages: {
    key: string;
    value: PendingMessage;
    indexes: { 'by-conversation': string };
  };
}

const DB_NAME = 'chatr-message-queue';
const DB_VERSION = 1;
const MAX_RETRIES = 5;

let db: IDBPDatabase<MessageQueueDB> | null = null;

const initDB = async (): Promise<IDBPDatabase<MessageQueueDB>> => {
  if (db) return db;
  db = await openDB<MessageQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('pending_messages', { keyPath: 'id' });
      store.createIndex('by-conversation', 'conversation_id');
    },
  });
  return db;
};

export const messageQueueService = {
  /**
   * Queue a message for sending
   */
  async queueMessage(message: Omit<PendingMessage, 'id' | 'retry_count' | 'last_attempt' | 'created_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const pending: PendingMessage = {
      ...message,
      id,
      retry_count: 0,
      last_attempt: Date.now(),
      created_at: new Date().toISOString()
    };

    const database = await initDB();
    await database.put('pending_messages', pending);
    
    // Try to send immediately if online
    this.processQueue();
    
    return id;
  },

  /**
   * Process all pending messages
   */
  async processQueue() {
    const status = await Network.getStatus();
    if (!status.connected) return;

    const database = await initDB();
    const pending = await database.getAll('pending_messages');
    
    for (const msg of pending) {
      // Exponential backoff
      const delay = Math.pow(2, msg.retry_count) * 1000;
      if (Date.now() - msg.last_attempt < delay) continue;

      try {
        const { error } = await supabase
          .from('messages')
          .insert({
            id: msg.id, // Use client ID for idempotency
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            content: msg.content,
            message_type: msg.message_type,
            media_url: msg.media_url,
            media_thumbnail_url: msg.media_thumbnail_url,
            created_at: msg.created_at
          });

        if (!error || error.code === '23505') { // Success or duplicate key (idempotency)
          await database.delete('pending_messages', msg.id);
          console.log(`✅ [Queue] Message ${msg.id} sent successfully`);
        } else {
          throw error;
        }
      } catch (e) {
        console.error(`❌ [Queue] Failed to send message ${msg.id}:`, e);
        msg.retry_count += 1;
        msg.last_attempt = Date.now();
        
        if (msg.retry_count >= MAX_RETRIES) {
          console.error(`🚫 [Queue] Max retries reached for message ${msg.id}`);
          // Keep it in DB but maybe mark as failed in UI?
        }
        
        await database.put('pending_messages', msg);
      }
    }
  },

  /**
   * Get pending messages for a conversation
   */
  async getPendingForConversation(conversationId: string): Promise<PendingMessage[]> {
    const database = await initDB();
    return database.getAllFromIndex('pending_messages', 'by-conversation', conversationId);
  }
};

// Auto-process queue on network restoration
void (async () => {
  await Network.addListener('networkStatusChange', (status) => {
    if (status.connected) {
      console.log('🌐 [Queue] Network restored, processing queue...');
      messageQueueService.processQueue();
    }
  });
})();
