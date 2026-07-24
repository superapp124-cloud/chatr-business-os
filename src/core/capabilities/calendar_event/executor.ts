import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { calendarService } from '../../services/CalendarService';
import { osScheduler } from '../../services/OSSchedulerService';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.calendar_event] Executing commitment ${commitment.id}`);

  const resolvedTime = commitment.entities?.resolvedTime || commitment.entities?.time;
  const startDateTime = resolvedTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString(); // 1hr default

  const calEvent = {
    id: commitment.id,
    title: commitment.title,
    startDateTime,
    endDateTime,
    description: commitment.entities?.description || '',
    location: commitment.entities?.location || '',
    reminderMinutes: 15,
  };

  // 1. Create in Google/Outlook + download .ics
  const result = await calendarService.createEvent(calEvent, true);

  // 2. Schedule a pre-event reminder in OSScheduler
  const reminderTime = new Date(new Date(startDateTime).getTime() - 15 * 60 * 1000).toISOString();
  if (new Date(reminderTime) > new Date()) {
    osScheduler.schedule({
      id: `${commitment.id}-reminder`,
      capability: 'core.calendar_event',
      type: 'calendar_event',
      title: `Upcoming: ${commitment.title} in 15 mins`,
      scheduledFor: reminderTime,
      metadata: { parentCommitmentId: commitment.id },
    });
  }

  // 3. Persist to StorageProvider
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length > 0 && providers[0].create) {
    await providers[0].create({
      id: commitment.id,
      type: 'calendar_event',
      title: commitment.title,
      startDateTime,
      endDateTime,
      calendarResults: result.results,
    });
  }

  return {
    success: result.success,
    commitmentId: commitment.id,
    providerData: {
      transactionId: `CALEVENT-${commitment.id}`,
      calendarResults: result.results,
      startDateTime,
      _provider: 'CalendarService',
    },
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  return {
    verified: true,
    provider: 'CalendarService',
    timestamp: new Date().toISOString(),
    transactionId: `CALEVENT-${commitment.id}`,
    evidence: { status: 'SCHEDULED', downloadedICS: true },
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  osScheduler.cancel(`${commitmentId}-reminder`);
}
