/**
 * CabBookingWorkflow — Reference Implementation of WorkflowCapabilityContract
 *
 * This is the first workflow built on the Workflow UI SDK.
 * It demonstrates the complete vertical slice:
 *
 *   User message → Intent → Workflow → Kernel Events → Workflow UI → User Action → Completion
 *
 * Architecture:
 *   - Implements WorkflowCapabilityContract (manifest + lifecycle methods)
 *   - Communicates ONLY via emitWorkflowUIEvent() → eventBus → WorkflowUIRuntime
 *   - Listens for user actions via eventBus.on('CAB_BOOKING.WIDGET_ACTION', ...)
 *   - Never imports React or references components directly
 *
 * Data: All mock (uses MockTravelProviders pattern already in codebase).
 * Real API integration (Ola, Uber, Rapido) is Phase 2 capability work.
 */

import { eventBus } from '@/core/runtime/EventBus';
import { executionOrchestrator } from '@/core/providers';
import '@/core/providers/MockRideProviders';
import {
  emitWorkflowUIEvent,
  buildWorkflowId,
  buildWidgetId,
  WorkflowCapabilityContract,
  WorkflowContext,
  WorkflowManifest,
  ProgressWidgetPayload,
  SelectionWidgetPayload,
  ConfirmationWidgetPayload,
  TrackingWidgetPayload,
  ResultWidgetPayload,
  WidgetAction,
} from '@/core/workflow-ui';
import type { ExecutionConsoleWidgetPayload, ExecutionPhase } from '@/core/workflow-ui/types';

// ─── Manifest ─────────────────────────────────────────────────────────────────

const CAB_BOOKING_MANIFEST: WorkflowManifest = {
  id: 'CAB_BOOKING',
  version: '1.0',
  name: 'Book a Cab',
  description: 'On-device cab booking using live price comparison',
  widgets: ['progress', 'selection', 'confirmation', 'tracking', 'result', 'execution_console', 'timeline', 'route_picker'],
  permissions: ['LOCATION', 'CONTACTS'],
  resumable: true,
  timeout: 300_000,   // 5 minutes
  cancellable: true,
  supportsNestedWorkflows: false,
  estimatedSteps: 5,
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DRIVER = {
  agentName: 'Vikash Kumar',
  agentRating: 4.8,
  agentVehicle: 'White Dzire',
  agentPlate: 'DL 1RTC 1234',
  otp: '4821',
  eta: '7 min',
};

// ─── CabBookingWorkflow ────────────────────────────────────────────────────────

export class CabBookingWorkflow implements WorkflowCapabilityContract {
  readonly manifest = CAB_BOOKING_MANIFEST;

  private workflowId = '';
  private progressWidgetId = '';
  private executionConsoleWidgetId = '';
  private timelineWidgetId = '';
  private selectionWidgetId = '';
  private confirmationWidgetId = '';
  private trackingWidgetId = '';
  private resultWidgetId = '';
  private widgetIndex = 0;
  private unsubscribeFn?: () => void;
  private selectedOptionId: string | null = null;
  private discoveredOptions: any[] = [];
  private driverSimIntervalId?: ReturnType<typeof setInterval>;
  // Per-phase timing for Execution Console
  private phaseStartTimes: Record<string, number> = {};

  // ─── WorkflowCapabilityContract ──────────────────────────────────────────

  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, 'cab-booking');

    // Signal workflow start to WorkflowUIRuntime
    emitWorkflowUIEvent({
      event: 'WORKFLOW_STARTED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'progress',
      widgetVersion: '1.0',
      lifecycle: 'CREATED',
      payload: { manifest: this.manifest },
    });

    // ── Execution Console: created immediately so user sees AI thinking live ──
    this.executionConsoleWidgetId = buildWidgetId(this.workflowId, 'execution_console', this.widgetIndex++);
    const initialConsolePayload: ExecutionConsoleWidgetPayload = {
      aiMode: 'local',
      expanded: false,
      phases: [
        { id: 'intent',     label: 'Intent Understood',   status: 'running' },
        { id: 'planning',   label: 'Planning',            status: 'pending' },
        { id: 'discovery',  label: 'Provider Discovery',  status: 'pending' },
        { id: 'execution',  label: 'Execution',           status: 'pending' },
        { id: 'tracking',   label: 'Live Tracking',       status: 'pending' },
      ],
    };
    this.phaseStartTimes['intent'] = Date.now();
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: initialConsolePayload,
    });

    // ── Timeline Widget: created at start, stays alive for full audit log ──
    this.timelineWidgetId = buildWidgetId(this.workflowId, 'timeline', this.widgetIndex++);
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.timelineWidgetId,
      widgetType: 'timeline',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { title: 'Workflow Timeline', entries: [] },
    });

    // Subscribe to user action events re-emitted by WorkflowUIRuntime
    this.unsubscribeFn = eventBus.on<WidgetAction>(
      'CAB_BOOKING.WIDGET_ACTION',
      (kernelEvent) => this.handleWidgetAction(kernelEvent.payload)
    );
  }

  async execute(context: WorkflowContext): Promise<void> {
    // Step 1: Show progress tracker
    await this.showProgress();

    // Step 2: Simulate understanding (1s)
    await this.delay(1000);
    await this.updateStep('understanding', 'completed');

    // Step 3: Ask for location details via FormWidget
    await this.showDetailsForm(context);
    // Execution pauses here. It resumes in handleWidgetAction ('SUBMIT').
  }

  async pause(_context: WorkflowContext): Promise<void> {
    // Future: serialize mid-state for resumability
  }

  async resume(_context: WorkflowContext): Promise<void> {
    emitWorkflowUIEvent({
      event: 'WORKFLOW_RESUMED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'progress',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: {},
    });
  }

  async cancel(_context: WorkflowContext): Promise<void> {
    this.cleanup();
    emitWorkflowUIEvent({
      event: 'WORKFLOW_CANCELLED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'result',
      widgetVersion: '1.0',
      lifecycle: 'CANCELLED',
      payload: {},
    });
  }

  async rollback(_context: WorkflowContext): Promise<void> {
    // Future: cancel booked cab via provider API
  }

  async complete(_context: WorkflowContext): Promise<void> {
    this.cleanup();
  }

  // ─── Internal Flow Steps ─────────────────────────────────────────────────

  private async showProgress(): Promise<void> {
    this.progressWidgetId = buildWidgetId(this.workflowId, 'progress', this.widgetIndex++);

    const payload: ProgressWidgetPayload = {
      title: 'Booking Cab',
      subtitle: 'Working on it...',
      estimatedMs: 45_000,
      showSecureExecution: true,
      steps: [
        { id: 'understanding', title: 'Understanding your request', status: 'running' },
        { id: 'finding',       title: 'Finding providers',          status: 'pending' },
        { id: 'comparing',     title: 'Comparing prices',           status: 'pending' },
        { id: 'booking',       title: 'Booking cab',                status: 'pending' },
        { id: 'confirmation',  title: 'Confirmation',               status: 'pending' },
      ],
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.progressWidgetId,
      widgetType: 'progress',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload,
    });
  }

  private async updateStep(
    stepId: string,
    status: 'running' | 'completed' | 'failed' | 'pending'
  ): Promise<void> {
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.progressWidgetId,
      widgetType: 'progress',
      widgetVersion: '1.0',
      lifecycle: status === 'completed' ? 'ACTIVE' : 'ACTIVE',
      payload: { stepUpdate: { id: stepId, status } },
    });
  }

  private formWidgetId = '';
  private bookingDetails: Record<string, unknown> = {};

  private async showDetailsForm(context: WorkflowContext): Promise<void> {
    this.formWidgetId = buildWidgetId(this.workflowId, 'route_picker', this.widgetIndex++);
    
    const origin = (context.entities?.origin as string) || 'Current Location';
    const destination = (context.entities?.destination as string) || (context.entities?.to as string) || '';

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.formWidgetId,
      widgetType: 'route_picker',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload: {
        title: 'Where to?',
        subtitle: 'Enter pickup and drop locations',
        origin,
        destination,
        ctaLabel: 'Find Cabs',
        mode: 'driving'
      },
    });
  }

  private async continueAfterForm(): Promise<void> {
    // Mark intent phase complete
    this.updateExecutionPhase('intent', 'completed');
    this.phaseStartTimes['planning'] = Date.now();
    this.updateExecutionPhase('planning', 'running');

    await this.updateStep('finding', 'running');
    
    // Mark planning done, discovery running
    this.updateExecutionPhase('planning', 'completed');
    this.phaseStartTimes['discovery'] = Date.now();
    this.updateExecutionPhase('discovery', 'running');

    // 🔥 Execution Layer handles discovery
    this.discoveredOptions = await executionOrchestrator.discoverOptions(
      'CAB_BOOKING', 
      'cab', 
      this.bookingDetails
    );

    // Discovery complete
    this.updateExecutionPhase('discovery', 'completed', undefined, `${this.discoveredOptions.length} providers found`);
    await this.updateStep('finding', 'completed');

    await this.updateStep('comparing', 'running');
    await this.delay(500);
    
    await this.showSelection(this.discoveredOptions);
    await this.updateStep('comparing', 'completed');
    
    await this.updateStep('booking', 'pending');
  }

  private async showSelection(options: any[]): Promise<void> {
    this.selectionWidgetId = buildWidgetId(this.workflowId, 'selection', this.widgetIndex++);

    const payload: SelectionWidgetPayload = {
      title: 'Best Options Found',
      subtitle: 'On-device web search & automation',
      columns: [
        { key: 'provider', label: 'Provider', type: 'text', primary: true },
        { key: 'price',    label: 'Price',    type: 'currency', currencyCode: 'INR' },
        { key: 'eta',      label: 'ETA',      type: 'duration' },
      ],
      options: options,
      totalCount: options.length,
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.selectionWidgetId,
      widgetType: 'selection',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload,
    });
  }

  private async showConfirmation(optionId: string): Promise<void> {
    this.confirmationWidgetId = buildWidgetId(this.workflowId, 'confirmation', this.widgetIndex++);
    const option = this.discoveredOptions.find(o => o.id === optionId) || { values: { provider: 'Unknown', price: '---' } };

    const payload: ConfirmationWidgetPayload = {
      title: "Sure, I'll book a cab for you.",
      subtitle: 'I understood:',
      lines: [
        { label: 'From',      value: String(this.bookingDetails.origin || 'Unknown'), highlight: false },
        { label: 'To',        value: String(this.bookingDetails.destination || 'Unknown'),   highlight: false },
        { label: 'Schedule',  value: this.bookingDetails.isScheduled ? `${this.bookingDetails.scheduleDate} at ${this.bookingDetails.scheduleTime}` : 'Now', highlight: false },
        { label: 'Provider',  value: String(option.values.provider), highlight: true },
        { label: 'Fare',      value: `₹${option.values.price}`, highlight: true },
      ],
      ctaLabel: 'Confirm Booking',
      abortLabel: 'Stop Task',
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.confirmationWidgetId,
      widgetType: 'confirmation',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload,
    });
  }

  private async executeBooking(): Promise<void> {
    console.log(`[CabBookingWorkflow] executeBooking() started for workflowId=${this.workflowId}`);
    
    // Mark discovery complete (if not already), start execution
    this.phaseStartTimes['execution'] = Date.now();
    this.updateExecutionPhase('execution', 'running');

    // Update progress: booking step running
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.progressWidgetId,
      widgetType: 'progress',
      widgetVersion: '1.0',
      lifecycle: 'EXECUTING',
      payload: { stepUpdate: { id: 'booking', status: 'running' } },
    });
    // Let the Orchestrator execute the provider strategy!
    const option = this.discoveredOptions.find(o => o.id === this.selectedOptionId);
    let providerName = 'Unknown';
    if (option) {
      providerName = String(option.values.provider);
      await executionOrchestrator.executeOption('CAB_BOOKING', option.providerId || option.id.split('-')[0], this.bookingDetails);
    }

    this.updateExecutionPhase('execution', 'completed', undefined, `Booked via ${providerName}`);
    this.phaseStartTimes['tracking'] = Date.now();
    this.updateExecutionPhase('tracking', 'running');

    // Update progress: confirmation step
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.progressWidgetId,
      widgetType: 'progress',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { stepUpdate: { id: 'confirmation', status: 'completed' } },
    });

    // Show the tracking UI — do NOT emit WORKFLOW_COMPLETED here because
    // that would immediately archive all widgets (including tracking) before React renders them.
    // The workflow stays alive while the user is on the tracking screen.
    await this.showTracking();
    this.simulateDriverApproach();
  }


  private async showTracking(): Promise<void> {
    this.trackingWidgetId = buildWidgetId(this.workflowId, 'tracking', this.widgetIndex++);

    const payload: TrackingWidgetPayload = {
      title: 'Your cab is booked! 🎉',
      status: 'Ride confirmed',
      ...MOCK_DRIVER,
      showMap: true,
      driverProgress: 0.1,
      driverDistance: '3.2 km away',
      actions: [
        { id: 'CALL_DRIVER',  label: 'Call Driver',  icon: 'phone',  variant: 'default' },
        { id: 'SHARE_RIDE',   label: 'Share Ride',   icon: 'share',  variant: 'default' },
        { id: 'ADD_CALENDAR', label: 'Add to Calendar' },
        { id: 'CANCEL_RIDE',  label: 'Cancel Ride',  icon: 'cancel', variant: 'danger' },
      ],
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.trackingWidgetId,
      widgetType: 'tracking',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload,
    });
  }

  private simulateDriverApproach(): void {
    const states = [
      { progress: 0.3, distance: '2.1 km away', eta: '9 min', status: 'Driver En Route' },
      { progress: 0.6, distance: '1.4 km away', eta: '6 min', status: 'Approaching' },
      { progress: 0.8, distance: '0.6 km away', eta: '3 min', status: 'Almost There' },
      { progress: 1.0, distance: '0.0 km',      eta: '0 min', status: 'Driver is here!' },
    ];
    let step = 0;

    this.driverSimIntervalId = setInterval(() => {
      if (step >= states.length) {
        clearInterval(this.driverSimIntervalId);
        this.updateExecutionPhase('tracking', 'completed', undefined, 'Driver arrived');
        // Complete the workflow!
        emitWorkflowUIEvent({
          event: 'WORKFLOW_COMPLETED',
          workflowId: this.workflowId,
          widgetId: this.workflowId,
          widgetType: 'result',
          widgetVersion: '1.0',
          lifecycle: 'COMPLETED',
          payload: {},
        });
        return;
      }

      const state = states[step++];
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.trackingWidgetId,
        widgetType: 'tracking',
        widgetVersion: '1.0',
        lifecycle: 'ACTIVE',
        payload: {
          driverProgress: state.progress,
          driverDistance: state.distance,
          eta: state.eta,
          status: state.status,
        },
      });
    }, 4000);
  }

  // ─── Widget Action Handler ────────────────────────────────────────────────
  private async handleWidgetAction(action: WidgetAction): Promise<void> {
    try {
      if (action.workflowId !== this.workflowId) return;

      console.log(`[CabBookingWorkflow] Received action:`, action);

      switch (action.action) {
        case 'RESUBMIT': {
          if (action.widgetId === this.formWidgetId) {
            this.bookingDetails = action.data as Record<string, unknown>;
            this.continueAfterForm();
          }
          break;
        }

        case 'SUBMIT': {
          if (action.widgetId === this.formWidgetId) {
            this.bookingDetails = action.data as Record<string, unknown>;
            emitWorkflowUIEvent({
              event: 'WIDGET_LIFECYCLE',
              workflowId: this.workflowId,
              widgetId: this.formWidgetId,
              widgetType: 'route_picker',
              widgetVersion: '1.0',
              lifecycle: 'COMPLETED',
              payload: {},
            });
            this.continueAfterForm();
          }
          break;
        }

        case 'SELECT': {
          if (action.widgetId === this.selectionWidgetId) {
            this.selectedOptionId = (action.data.optionId as string) || (action.data.selectedIds as string[])?.[0];
          }
          break;
        }

        case 'CONFIRM_SELECTION': {
          if (action.widgetId === this.selectionWidgetId) {
            this.selectedOptionId = (action.data.optionId as string) || (action.data.selectedIds as string[])?.[0];
            
            emitWorkflowUIEvent({
              event: 'WIDGET_LIFECYCLE',
              workflowId: this.workflowId,
              widgetId: this.selectionWidgetId,
              widgetType: 'selection',
              widgetVersion: '1.0',
              lifecycle: 'COMPLETED',
              payload: {},
            });

            this.showConfirmation(this.selectedOptionId);
          }
          break;
        }

        case 'CONFIRM': {
          // Use the incoming widgetId — if our stored ID doesn't match (edge case from
          // pre-existing widgets or HMR), sync it up and proceed anyway.
          if (!this.confirmationWidgetId || this.confirmationWidgetId === action.widgetId) {
            this.confirmationWidgetId = action.widgetId;
            console.log(`[CabBookingWorkflow] CONFIRM received for widget ${action.widgetId}`);
            emitWorkflowUIEvent({
              event: 'WIDGET_LIFECYCLE',
              workflowId: this.workflowId,
              widgetId: this.confirmationWidgetId,
              widgetType: 'confirmation',
              widgetVersion: '1.0',
              lifecycle: 'COMPLETED',
              payload: {},
            });
            this.executeBooking().catch(err => {
              console.error("[CabBookingWorkflow] executeBooking failed:", err);
            });
          } else {
            // ID mismatch — the user is clicking an old widget from a different run.
            // Sync the ID and fire anyway so it's not silently dropped.
            console.warn(`[CabBookingWorkflow] CONFIRM id mismatch: expected=${this.confirmationWidgetId} got=${action.widgetId}. Proceeding anyway.`);
            this.confirmationWidgetId = action.widgetId;
            emitWorkflowUIEvent({
              event: 'WIDGET_LIFECYCLE',
              workflowId: this.workflowId,
              widgetId: this.confirmationWidgetId,
              widgetType: 'confirmation',
              widgetVersion: '1.0',
              lifecycle: 'COMPLETED',
              payload: {},
            });
            this.executeBooking().catch(err => {
              console.error("[CabBookingWorkflow] executeBooking failed:", err);
            });
          }
          break;
        }

        case 'CANCEL': {
          this.cancel({ workflowId: this.workflowId, conversationId: '', intent: {}, entities: {} });
          break;
        }
      }
    } catch (error: any) {
      console.error("[CabBookingWorkflow] handleWidgetAction failed:", error);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Execution Console State ───
  private executionPhases: ExecutionPhase[] = [
    { id: 'intent',     label: 'Intent Understood',   status: 'pending' },
    { id: 'planning',   label: 'Planning',            status: 'pending' },
    { id: 'discovery',  label: 'Provider Discovery',  status: 'pending' },
    { id: 'execution',  label: 'Execution',           status: 'pending' },
    { id: 'tracking',   label: 'Live Tracking',       status: 'pending' },
  ];

  private async updateExecutionPhase(
    phaseId: string,
    status: 'running' | 'completed' | 'failed' | 'pending',
    latencyOverride?: number,
    detail?: string
  ): Promise<void> {
    const phase = this.executionPhases.find(p => p.id === phaseId);
    if (!phase) return;

    phase.status = status;
    if (detail) phase.detail = detail;

    if (status === 'completed' && this.phaseStartTimes[phaseId]) {
      phase.latencyMs = latencyOverride ?? (Date.now() - this.phaseStartTimes[phaseId]);
    }

    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phases: [...this.executionPhases] },
    });
  }

  private cleanup(): void {
    if (this.driverSimIntervalId) {
      clearInterval(this.driverSimIntervalId);
      this.driverSimIntervalId = undefined;
    }
    this.unsubscribeFn?.();
    this.unsubscribeFn = undefined;
  }
}

/**
 * Call this from AIChat when a cab booking intent is detected.
 * Returns the workflowId so the message can be linked to its WorkflowRenderer.
 */
export async function triggerCabBooking(conversationId: string, entities: Record<string, unknown> = {}): Promise<string> {
  const context: WorkflowContext = {
    workflowId: buildWorkflowId(conversationId, 'cab-booking'),
    conversationId,
    intent: { action: 'CAB_BOOKING' },
    entities,
  };

  // Instantiate a fresh workflow per request so state/subscriptions don't collide
  const workflow = new CabBookingWorkflow();
  await workflow.initialize(context);
  workflow.execute(context);   // fire-and-forget; events drive the UI

  return context.workflowId;
}
