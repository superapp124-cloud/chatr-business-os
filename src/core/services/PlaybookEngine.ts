import { Commitment, Capability } from '../capabilities/types';
import { eventBus } from '@/core/runtime/EventBus';
import { genericPlaybook } from '../capabilities/genericPlaybook';
import { calendarService } from './CalendarService';

// Capability type → retrieval provider mapping
const CAPABILITY_RETRIEVAL_MAP: Record<string, string> = {
  'core.flight_booking':     'flight',
  'core.hotel_booking':      'hotel',
  'core.meeting':            'calendar',
  'core.calendar_event':     'calendar',
  'core.candidate_interview':'calendar',
};

export class PlaybookEngineImpl {
  private static instance: PlaybookEngineImpl;

  private constructor() {}

  public static getInstance(): PlaybookEngineImpl {
    if (!PlaybookEngineImpl.instance) {
      PlaybookEngineImpl.instance = new PlaybookEngineImpl();
    }
    return PlaybookEngineImpl.instance;
  }

  /**
   * Executes the capability playbook up to the point of execution.
   * Emits events to pause for user input (missing fields) or final confirmation (preview).
   */
  public async run(commitment: Commitment, capability: Capability): Promise<Commitment> {
    const playbook = capability.playbook || genericPlaybook;
    console.log(`[PlaybookEngine] Running playbook for ${commitment.id}`);

    // Transition to extracting state
    commitment = this.updateCommitment(commitment, 'extracting');

    // Step 1: Extract entities from raw text
    const rawText = commitment.title;
    const extracted = playbook.extract(rawText);

    // Step 2: Resolve context (time expressions → ISO, etc.)
    const resolved = await playbook.resolve(extracted, { userId: 'current' });
    commitment.entities = resolved;

    // Step 3: Check for missing fields
    const missingFields = playbook.getMissingFields(resolved);
    if (missingFields.length > 0) {
      console.log(`[PlaybookEngine] Missing fields:`, missingFields.map(f => f.key));
      commitment.missingFields = missingFields;
      commitment = this.updateCommitment(commitment, 'needs_input');
      return commitment;
    }

    // Step 4: No missing fields — search or preview
    return this.proceedToSearchOrPreview(commitment, playbook);
  }

  /**
   * Resumes a playbook after user provides a missing field value.
   */
  public async resumeWithInput(
    commitment: Commitment,
    capability: Capability,
    inputKey: string,
    inputValue: string
  ): Promise<Commitment> {
    const playbook = capability.playbook || genericPlaybook;
    if (!commitment.entities) return commitment;

    // Apply input
    commitment.entities[inputKey] = inputValue;

    // If the input was a time field, resolve it to ISO
    if (inputKey === 'time' && inputValue) {
      const { resolve } = playbook;
      const re = await resolve({ ...commitment.entities, time: inputValue }, {});
      commitment.entities = re;
    }

    // Re-check missing fields
    const missingFields = playbook.getMissingFields(commitment.entities);
    if (missingFields.length > 0) {
      commitment.missingFields = missingFields;
      commitment = this.updateCommitment(commitment, 'needs_input');
      return commitment;
    }

    commitment.missingFields = undefined;
    return this.proceedToSearchOrPreview(commitment, playbook);
  }

  /**
   * Called when user selects a search result (e.g. a flight or calendar slot).
   */
  public async selectResult(
    commitment: Commitment,
    capability: Capability,
    selectedResult: any
  ): Promise<Commitment> {
    const playbook = capability.playbook || genericPlaybook;
    commitment.selectedResult = selectedResult;
    const preview = playbook.buildPreview(commitment.entities || {}, selectedResult);
    commitment.preview = preview;
    commitment = this.updateCommitment(commitment, 'preview_ready');
    return commitment;
  }

  private async proceedToSearchOrPreview(commitment: Commitment, playbook: any): Promise<Commitment> {
    const requiresSearch = playbook.requiresSearch && playbook.requiresSearch(commitment.entities);

    if (requiresSearch) {
      commitment = this.updateCommitment(commitment, 'searching');
      let results: any[] = [];

      const capabilityType = CAPABILITY_RETRIEVAL_MAP[commitment.capability];

      try {
        if ((window as any).electronAPI?.invoke) {
          const queryStr = playbook.buildSearchQuery ? playbook.buildSearchQuery(commitment.entities) : commitment.title;
          results = await new Promise<any[]>((resolve) => {
            const timeout = setTimeout(() => resolve([]), 15000);
            
            const handler = (event: any, data: any) => {
              const payload = data || event; // handle different IPC event structures
              if (!payload || !payload.results) return;
              
              const resMap: Record<string, any> = payload.results;
              let rawOptions: any[] = [];
              for (const nodeResult of Object.values(resMap)) {
                const output = (nodeResult as any)?.output;
                if (output?.options && Array.isArray(output.options)) {
                  rawOptions = output.options;
                  break;
                } else if (output?.items && Array.isArray(output.items)) {
                  rawOptions = output.items;
                  break;
                } else if (Array.isArray(output)) {
                  rawOptions = output;
                  break;
                } else if (output && typeof output === 'object') {
                  rawOptions = [output];
                }
              }
              
              clearTimeout(timeout);
              if ((window as any).electronAPI.off) {
                (window as any).electronAPI.off('execution:plan_completed', handler);
              }
              resolve(rawOptions);
            };
            
            if ((window as any).electronAPI.on) {
              (window as any).electronAPI.on('execution:plan_completed', handler);
            }
            
            (window as any).electronAPI.invoke('kernel:intent:process', queryStr).catch((err: any) => {
              console.error('[PlaybookEngine] Kernel error:', err);
              resolve([]);
            });
          });
        } else {
          // Fallback
          const { universalRetrievalEngine } = await import('../providers/UniversalRetrievalEngine');
          const query = playbook.buildSearchQuery ? playbook.buildSearchQuery(commitment.entities) : '';
          results = await universalRetrievalEngine.retrieve(capabilityType || 'generic', query);
        }
      } catch (err) {
        console.error(`[PlaybookEngine] Search failed for ${commitment.capability}:`, err);
        results = [];
      }

      commitment.searchResults = playbook.formatSearchResults
        ? playbook.formatSearchResults(results)
        : results;

      commitment = this.updateCommitment(commitment, 'results_ready');
      return commitment;
    }

    // No search — straight to preview
    const preview = playbook.buildPreview(commitment.entities || {});
    commitment.preview = preview;
    commitment = this.updateCommitment(commitment, 'preview_ready');
    return commitment;
  }

  private updateCommitment(commitment: Commitment, status: Commitment['status']): Commitment {
    const updated = { ...commitment, status };
    eventBus.publish('chatr:commitment-state-changed', updated, 'PlaybookEngine');
    return updated;
  }
}

export const playbookEngine = PlaybookEngineImpl.getInstance();
