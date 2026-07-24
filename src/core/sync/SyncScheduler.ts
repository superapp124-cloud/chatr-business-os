import { jobQueue } from './JobQueue';
import { identityManager } from '../auth/IdentityManager';

export class SyncScheduler {
  
  public async initialize(): Promise<void> {
    console.log('[SyncScheduler] Initializing background sync daemons...');
    
    // Register the unified sync handler
    jobQueue.registerHandler('provider_sync', async (payload: { accountId: string, providerId: string }) => {
      console.log(`[SyncScheduler] Executing sync for account ${payload.accountId} (${payload.providerId})`);
      
      // In real implementation, this would look up the provider from IdentityManager
      // const provider = identityManager.getProvider(payload.providerId);
      // await provider.sync(payload.accountId);

      // Simulate a successful sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`[SyncScheduler] Sync completed for account ${payload.accountId}`);

      // Schedule next incremental sync in 15 minutes
      await this.scheduleSync(payload.accountId, payload.providerId, Date.now() + 15 * 60 * 1000);
    });
  }

  public async scheduleSync(accountId: string, providerId: string, runAt?: number): Promise<void> {
    await jobQueue.enqueue(
      'provider_sync', 
      { accountId, providerId },
      { priority: 5, runAt: runAt || Date.now() }
    );
    console.log(`[SyncScheduler] Scheduled sync for ${accountId}`);
  }

  public async startGlobalSync(): Promise<void> {
    // Fire off syncs for all connected accounts immediately (e.g. on app startup)
    const accounts = await identityManager.getConnectedAccounts();
    for (const acc of accounts) {
      await this.scheduleSync(acc.accountId, acc.providerId);
    }
  }
}

export const syncScheduler = new SyncScheduler();
