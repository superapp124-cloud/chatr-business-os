import { TokenManager } from '../auth/TokenManager';
import { LocalDB, StoredMessage } from '../db/LocalDB';
import { IntelligenceEngine } from '../ai/IntelligenceEngine';

export interface SyncProviderAdapter {
  fetchPage(accountId: string, accessToken: string, pageToken?: string): Promise<{
    messages: any[];
    nextPageToken?: string;
  }>;
  parseMessage(raw: any): Omit<StoredMessage, 'id'> & { id: string };
}

export class MailSyncEngine {
  private static isSyncing = false;

  /**
   * Orchestrates the multi-stage queue: Download -> Parse -> AI -> DB
   */
  static async syncAccount(accountId: string, providerId: string, adapter: SyncProviderAdapter) {
    if (this.isSyncing) {
      console.log('[MailSyncEngine] Sync already in progress. Skipping.');
      return;
    }
    this.isSyncing = true;
    console.log(`[MailSyncEngine] Starting background sync for ${accountId}`);

    try {
      const accounts = await TokenManager.getAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) throw new Error('Account not found');

      // 1. Download Queue (Paginated)
      let pageToken: string | undefined = undefined;
      let totalProcessed = 0;

      do {
        console.log(`[MailSyncEngine] Fetching page with token: ${pageToken || 'INITIAL'}`);
        
        window.dispatchEvent(new CustomEvent('chatr:sync_progress', { 
          detail: { accountId, step: 'Downloading emails...', progress: totalProcessed, max: 300 } 
        }));
        
        const response = await adapter.fetchPage(accountId, account.token.accessToken, pageToken);
        
        window.dispatchEvent(new CustomEvent('chatr:sync_progress', { 
          detail: { accountId, step: 'Parsing & Categorizing...', progress: totalProcessed + (response.messages.length / 2), max: 300 } 
        }));
        
        // 2. Parse Queue
        const parsedMessages = response.messages.map(adapter.parseMessage);
        
        // 3. AI Queue
        // In a real app, this runs the ONNX model locally in chunks
        const intelligentMessages = IntelligenceEngine.processBatch(accountId, parsedMessages);
        
        window.dispatchEvent(new CustomEvent('chatr:sync_progress', { 
          detail: { accountId, step: 'Detecting threats & Building search index...', progress: totalProcessed + response.messages.length, max: 300 } 
        }));
        
        // 4. Index & Store Queue
        await LocalDB.upsertMessages(intelligentMessages);
        
        totalProcessed += intelligentMessages.length;
        console.log(`[MailSyncEngine] Indexed ${totalProcessed} total messages.`);

        // Dispatch an event so the UI can update live
        window.dispatchEvent(new CustomEvent('chatr:sync_complete', { 
          detail: { accountId, count: intelligentMessages.length } 
        }));

        pageToken = response.nextPageToken;
        
        // MVP: Cap at 3 pages for the demo so it doesn't run infinitely in mock
        if (totalProcessed >= 300) break;
        
      } while (pageToken);

      console.log(`[MailSyncEngine] Finished sync for ${accountId}. Total processed: ${totalProcessed}`);
    } catch (e: any) {
      console.error(`[MailSyncEngine] Fatal sync error for ${accountId}`, e);
      window.dispatchEvent(new CustomEvent('chatr:sync_error', {
        detail: { accountId, error: e.message || 'Unknown sync error' }
      }));
    } finally {
      this.isSyncing = false;
      window.dispatchEvent(new CustomEvent('chatr:sync_complete', { 
        detail: { accountId, count: 0 } 
      }));
    }
  }
}
