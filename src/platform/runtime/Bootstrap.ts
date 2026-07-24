import { Runtime } from './Runtime';
import { Logger } from '../Infrastructure/Logger';

/**
 * Bootstrap is the entrypoint called by App.tsx.
 * It sets up the environment before the React tree fully renders.
 */
export async function bootstrapPlatform(): Promise<void> {
  try {
    Logger.info('====================================');
    Logger.info(' CHATR Platform Bootstrap Initiated');
    Logger.info('====================================');

    await Runtime.start();
    
    // Signal to PlatformContext that everything is ready
    (window as any).__PLATFORM_READY = true;
    Logger.info('[Bootstrap] Complete.');
  } catch (error) {
    Logger.error('[Bootstrap] Failed to initialize platform:', error);
    // Still set it so the UI doesn't hang indefinitely
    (window as any).__PLATFORM_READY = true;
  }
}
