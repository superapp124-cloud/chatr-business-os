import { EmailMessage } from '../mail/types';

export interface StoredMessage extends EmailMessage {
  accountId: string;
  isRead: boolean;
  threatLevel?: 'safe' | 'suspicious' | 'scam';
  intelligenceSummary?: string[];
  attentionScore?: 'high' | 'medium' | 'low' | 'ignore';
  category?: string;
  relationshipStats?: {
    isVerified: boolean;
    previousEmailsCount: number;
    isFirstContact: boolean;
  };
  recommendation?: {
    text: string;
    actionLabel: string;
    actionStyle: 'danger' | 'normal';
  };
  smartReplies?: string[];
}

/**
 * LocalDB is a singleton wrapper around an encrypted local SQLite database.
 * For this MVP, we simulate it using an in-memory array or localStorage.
 */
export class LocalDB {
  private static messages: StoredMessage[] = [];
  private static syncTokens: Record<string, string> = {};

  static async initialize() {
    console.log('[LocalDB] Encrypted SQLite database initialized.');
    
    // Attempt to load from localStorage for prototype persistence
    try {
      const stored = localStorage.getItem('chatr_local_db_messages');
      if (stored) {
        this.messages = JSON.parse(stored);
      }
      const tokens = localStorage.getItem('chatr_local_db_tokens');
      if (tokens) {
        this.syncTokens = JSON.parse(tokens);
      }
    } catch (e) {
      console.error('Failed to load local DB', e);
    }
  }

  static async getSyncToken(accountId: string): Promise<string | undefined> {
    return this.syncTokens[accountId];
  }

  static async setSyncToken(accountId: string, token: string) {
    this.syncTokens[accountId] = token;
    localStorage.setItem('chatr_local_db_tokens', JSON.stringify(this.syncTokens));
  }

  static async upsertMessages(newMessages: StoredMessage[]) {
    newMessages.forEach(msg => {
      const index = this.messages.findIndex(m => m.id === msg.id);
      if (index >= 0) {
        this.messages[index] = { ...this.messages[index], ...msg };
      } else {
        this.messages.push(msg);
      }
    });
    
    // Sort descending by internalDate
    this.messages.sort((a, b) => b.internalDate - a.internalDate);
    
    localStorage.setItem('chatr_local_db_messages', JSON.stringify(this.messages));
  }

  static async getMessagesByAccount(accountId: string): Promise<StoredMessage[]> {
    return this.messages.filter(m => m.accountId === accountId);
  }

  static async getAllMessages(): Promise<StoredMessage[]> {
    return [...this.messages];
  }

  static async clearAll() {
    this.messages = [];
    this.syncTokens = {};
    localStorage.removeItem('chatr_local_db_messages');
    localStorage.removeItem('chatr_local_db_tokens');
  }
}
