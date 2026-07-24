import { kernelBus } from './EventBus';
import { kernel } from '../abi';
import { CapabilityId, EntityId, ProcessId } from '../abi/v1';
import { emitWorkflowUIEvent, buildWidgetId } from '@/core/workflow-ui';

export class ProcessService {
  private activeProcesses = new Map<string, { state: string, lastActive: number, intentId?: string, type?: string }>();
  private abortControllers = new Map<string, AbortController>();
  private watchdogInterval: NodeJS.Timeout;

  constructor() {
    kernelBus.subscribe('process.spawned', this.handleProcessSpawned.bind(this));
    kernelBus.subscribe('process.discovery_completed', this.handleDiscoveryCompleted.bind(this));
    kernelBus.subscribe('process.resources_allocated', this.handleProcessExecution.bind(this));
    kernelBus.subscribe('process.retry_requested', this.handleRetryRequested.bind(this));
    
    // Watchdog trackers
    const events = [
      'process.spawned', 'process.discovery_completed', 'process.ranking_completed', 
      'process.selection_completed', 'process.policy_checked', 'process.resources_allocated', 
      'execution.started'
    ];
    events.forEach(evt => kernelBus.subscribe(evt, this.trackProcessActivity.bind(this)));
    
    kernelBus.subscribe('process.completed', this.untrackProcess.bind(this));
    kernelBus.subscribe('process.failed', this.untrackProcess.bind(this));
    
    // Deep Cancellation
    kernelBus.subscribe('process.cancelled', this.handleProcessCancelled.bind(this));
    kernelBus.subscribe('process.cancelled', this.untrackProcess.bind(this));

    this.watchdogInterval = setInterval(() => this.checkTimeouts(), 5000);
  }

  private trackProcessActivity(event: any) {
    const processId = event.content?.processId || event.payload?.processId || event.processId;
    const intentId = event.intentId || event.payload?.intentId;
    const type = event.payload?.type; // usually present on process.spawned
    
    if (processId) {
      const existing = this.activeProcesses.get(processId);
      this.activeProcesses.set(processId, { 
        state: event.type, 
        lastActive: Date.now(), 
        intentId,
        type: type || existing?.type
      });
    }
  }

  private untrackProcess(event: any) {
    const processId = event.content?.processId || event.payload?.processId || event.processId;
    if (processId) {
      this.activeProcesses.delete(processId);
    }
  }

  private async checkTimeouts() {
    const now = Date.now();
    const TIMEOUT_MS = 30000; // 30s max per stage for this demo

    for (const [processId, data] of this.activeProcesses.entries()) {
      // DAEMON and ACTOR processes are long-lived, do not timeout their execution loops
      if ((data.type === 'DAEMON' || data.type === 'ACTOR') && data.state === 'execution.started') {
        continue;
      }

      if (now - data.lastActive > TIMEOUT_MS) {
        console.warn(`[ProcessService] Watchdog caught timeout for ${processId} (${data.type}) in state ${data.state}`);
        this.activeProcesses.delete(processId);
        
        await kernelBus.publish({
          eventId: `evt_${Date.now()}`,
          type: 'process.failed',
          timestamp: Date.now(),
          sourceService: 'ProcessService',
          processId,
          intentId: data.intentId,
          payload: { error: `Process timed out during ${data.state}`, status: 'failed' },
          version: '1.0'
        });
      }
    }
  }

  private async handleProcessSpawned(event: any): Promise<void> {
    const { processId, intentId, payload } = event.payload;
    const { type } = payload;
    console.log(`[ProcessService] Spawned ${type} process: ${processId} for intent ${intentId}`);
  }

  private async handleDiscoveryCompleted(event: any): Promise<void> {
    const { processId, intentId, targetCapability } = event.payload;

    // Bridge to UI Timeline for backwards compatibility
    emitWorkflowUIEvent({
      event: 'WORKFLOW_STARTED',
      workflowId: intentId,
      widgetId: intentId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'CREATED',
      payload: { 
        manifest: { 
          id: 'KERNEL_CORE', 
          name: 'CHATR OS Kernel', 
          estimatedSteps: 6, 
          widgets: targetCapability === 'weather.current' ? ['weather', 'execution_console'] : ['execution_console'] 
        }
      },
    });

    const consoleId = buildWidgetId(intentId, 'execution_console', 0);
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: intentId,
      widgetId: consoleId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { steps: [] },
    });

    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: intentId,
      widgetId: consoleId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phaseUpdate: { id: 'spawning', status: 'completed', message: `Process spawned & discovered` } },
    });
  }

  private async handleProcessExecution(event: any): Promise<void> {
    const { processId, intentId, targetCapability, providerEntity } = event.payload;
    const authority = event.source || 'system';

    console.log(`[ProcessService] Executing capability ${targetCapability} on ${providerEntity.id}`);

    const consoleId = buildWidgetId(intentId, 'execution_console', 0);
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: intentId,
      widgetId: consoleId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
    });

    try {
      const token = await kernel.requestCapabilityToken(
        targetCapability as CapabilityId,
        authority as EntityId,
        { allowDelegation: false, ttlSeconds: 300, usageLimit: 1 }
      );

      if (!token) throw new Error('Failed to acquire token');

      // Create an AbortController for this execution
      const abortController = new AbortController();
      this.abortControllers.set(processId, abortController);

      await kernel.invokeCapability(
        targetCapability as CapabilityId,
        providerEntity.id,
        { rawInput: 'execution context' },
        token,
        { 
          entityId: authority as EntityId, 
          timestamp: Date.now(), 
          metadata: { processId, intentId },
          abortSignal: abortController.signal
        }
      );
      
    } catch (err: any) {
      console.error(`[ProcessService] Execution failed:`, err);
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: intentId,
        widgetId: consoleId,
        widgetType: 'execution_console',
        widgetVersion: '1.0',
        lifecycle: 'ACTIVE',
        payload: { phaseUpdate: { id: 'execution', status: 'failed', message: err.message } },
      });
    }
  }

  private async handleRetryRequested(event: any): Promise<void> {
    const { processId, intentId, currentRetry, maxRetries } = event.payload;
    const authority = event.source || 'system';
    
    // In a real system, the targetCapability and providerEntity should be preserved
    // in the WorldModel. We fetch them here.
    const processNode = (await import('../world/WorldModel')).worldModel.getNode(processId);
    if (!processNode) return;
    
    const targetCapability = processNode.properties.targetCapability || 'weather.current';
    const providerEntity = processNode.properties.providerEntity || { id: 'sys.provider.mock' };

    console.log(`[ProcessService] Retry ${currentRetry}/${maxRetries} scheduled for ${processId} in 3 seconds...`);
    
    const consoleId = buildWidgetId(intentId, 'execution_console', 0);
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: intentId,
      widgetId: consoleId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phaseUpdate: { id: 'execution', status: 'running', message: `Retrying execution (${currentRetry}/${maxRetries})...` } },
    });

    // Exponential backoff mock (just 3 seconds for demo)
    setTimeout(async () => {
      console.log(`[ProcessService] Executing retry ${currentRetry} for ${processId}`);
      await kernelBus.publish({
        eventId: `evt_${Date.now()}`,
        type: 'process.resources_allocated',
        timestamp: Date.now(),
        sourceService: 'ProcessService',
        authority,
        payload: { processId, intentId, targetCapability, providerEntity, isRetry: true },
        version: '1.0'
      });
    }, 3000);
  }

  private async handleProcessCancelled(event: any): Promise<void> {
    const processId = event.processId || event.payload?.processId;
    if (processId && this.abortControllers.has(processId)) {
      console.log(`[ProcessService] Deep cancellation triggered for process ${processId}`);
      this.abortControllers.get(processId)!.abort('User cancelled process');
      this.abortControllers.delete(processId);
    }
  }
}

export const processService = new ProcessService();
