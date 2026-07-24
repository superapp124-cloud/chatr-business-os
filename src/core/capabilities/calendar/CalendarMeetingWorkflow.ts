import { eventBus } from '@/core/runtime/EventBus';
import {
  emitWorkflowUIEvent,
  buildWorkflowId,
  buildWidgetId,
  WorkflowCapabilityContract,
  WorkflowContext,
  WorkflowManifest,
  SelectionWidgetPayload,
  ConfirmationWidgetPayload,
  WidgetAction,
} from '@/core/workflow-ui';
import type { ExecutionConsoleWidgetPayload, ExecutionPhase } from '@/core/workflow-ui/types';

// ─── Manifest ─────────────────────────────────────────────────────────────────

const CALENDAR_MEETING_MANIFEST: WorkflowManifest = {
  id: 'CALENDAR_MEETING',
  version: '1.0',
  name: 'Schedule a Meeting',
  description: 'Schedule a meeting by comparing availability across calendars',
  widgets: ['selection', 'confirmation', 'execution_console', 'timeline', 'meeting_tracking'],
  permissions: ['CALENDAR', 'CONTACTS'],
  resumable: true,
  timeout: 300_000,
  cancellable: true,
  supportsNestedWorkflows: false,
  estimatedSteps: 4,
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TIME_SLOTS = [
  { id: 'slot-1', time: '10:00 AM', duration: '30 min', date: 'Next Tuesday', status: 'Available' },
  { id: 'slot-2', time: '11:30 AM', duration: '30 min', date: 'Next Tuesday', status: 'Available', recommended: true },
  { id: 'slot-3', time: '2:00 PM', duration: '30 min', date: 'Next Tuesday', status: 'Available' },
];

const MOCK_ATTENDEES = [
  { name: 'John Doe', email: 'john@example.com', status: 'pending' },
  { name: 'Me', email: 'me@example.com', status: 'accepted' },
];

// ─── CalendarMeetingWorkflow ──────────────────────────────────────────────────

export class CalendarMeetingWorkflow implements WorkflowCapabilityContract {
  readonly manifest = CALENDAR_MEETING_MANIFEST;

  private workflowId = '';
  private executionConsoleWidgetId = '';
  private timelineWidgetId = '';
  private selectionWidgetId = '';
  private confirmationWidgetId = '';
  private trackingWidgetId = '';
  private widgetIndex = 0;
  private unsubscribeFn?: () => void;
  private selectedSlotId: string | null = null;
  private rsvpSimIntervalId?: ReturnType<typeof setInterval>;
  private phaseStartTimes: Record<string, number> = {};
  
  // State
  private attendees = [...MOCK_ATTENDEES];
  private meetingTitle = '';

  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, 'calendar-meeting');
    this.meetingTitle = (context.entities?.title as string) || 'Catch up / Sync';
    if (context.entities?.attendees) {
      this.attendees[0].name = context.entities.attendees as string;
    }

    // Signal workflow start
    emitWorkflowUIEvent({
      event: 'WORKFLOW_STARTED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console', // Using execution_console as root
      widgetVersion: '1.0',
      lifecycle: 'CREATED',
      payload: { manifest: this.manifest },
    });

    // ── Execution Console ──
    this.executionConsoleWidgetId = buildWidgetId(this.workflowId, 'execution_console', this.widgetIndex++);
    const initialConsolePayload: ExecutionConsoleWidgetPayload = {
      aiMode: 'local',
      expanded: false,
      phases: [
        { id: 'intent',     label: 'Intent Understood',   status: 'running' },
        { id: 'sync',       label: 'Calendar Sync',       status: 'pending' },
        { id: 'planning',   label: 'Finding Times',       status: 'pending' },
        { id: 'execution',  label: 'Execution',           status: 'pending' },
        { id: 'tracking',   label: 'Tracking RSVPs',      status: 'pending' },
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

    // ── Timeline Widget ──
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

    // Subscribe to UI interactions
    this.unsubscribeFn = eventBus.on<WidgetAction>(
      'CALENDAR_MEETING.WIDGET_ACTION',
      (kernelEvent) => this.handleWidgetAction(kernelEvent.payload)
    );
  }

  async execute(context: WorkflowContext): Promise<void> {
    // 1. Intent Understood
    await this.delay(800);
    await this.updateExecutionPhase('intent', 'completed', 'Identified attendees and timeframe');
    
    // 2. Calendar Sync
    await this.updateExecutionPhase('sync', 'running');
    await this.delay(1200);
    await this.updateExecutionPhase('sync', 'completed', 'Synced 2 calendars (No conflicts)');

    // 3. Finding Times
    await this.updateExecutionPhase('planning', 'running');
    await this.delay(1000);
    await this.updateExecutionPhase('planning', 'completed', `Found ${MOCK_TIME_SLOTS.length} slots`);

    // Execution pauses here to show Selection
    await this.showSelectionWidget();
  }

  private async handleWidgetAction(action: WidgetAction): Promise<void> {
    if (action.workflowId !== this.workflowId) return;

    if (action.action === 'SELECT' && action.widgetId === this.selectionWidgetId) {
      this.selectedSlotId = action.data.id as string;
      
      // Complete selection widget
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.selectionWidgetId,
        widgetType: 'selection',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: { selectedId: this.selectedSlotId },
      });

      await this.delay(500);
      await this.showConfirmationWidget();
    }

    if (action.action === 'CONFIRM' && action.widgetId === this.confirmationWidgetId) {
      // Complete confirmation
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.confirmationWidgetId,
        widgetType: 'confirmation',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: {},
      });

      await this.executeBooking();
    }

    if (action.action === 'CANCEL') {
      await this.cancel();
    }
  }

  private async showSelectionWidget(): Promise<void> {
    this.selectionWidgetId = buildWidgetId(this.workflowId, 'selection', this.widgetIndex++);
    const payload: SelectionWidgetPayload = {
      title: 'Suggested Times',
      subtitle: 'Pick a time that works for everyone',
      columns: [
        { key: 'time', label: 'Time', type: 'time', primary: true },
        { key: 'date', label: 'Date', type: 'text' },
        { key: 'status', label: 'Status', type: 'badge' }
      ],
      options: MOCK_TIME_SLOTS.map(s => ({
        id: s.id,
        values: { time: s.time, date: s.date, status: s.status },
        recommended: s.recommended,
        badge: s.recommended ? 'Best' : undefined,
        badgeVariant: s.recommended ? 'success' : undefined
      })),
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

  private async showConfirmationWidget(): Promise<void> {
    this.confirmationWidgetId = buildWidgetId(this.workflowId, 'confirmation', this.widgetIndex++);
    const slot = MOCK_TIME_SLOTS.find(s => s.id === this.selectedSlotId);

    const payload: ConfirmationWidgetPayload = {
      title: 'Confirm Meeting',
      subtitle: this.meetingTitle,
      lines: [
        { label: 'With', value: this.attendees.filter(a => a.name !== 'Me').map(a => a.name).join(', ') },
        { label: 'When', value: `${slot?.date} at ${slot?.time}`, highlight: true },
        { label: 'Duration', value: slot?.duration || '30 min' },
        { label: 'Platform', value: 'Google Meet' }
      ],
      ctaLabel: 'Send Invites',
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
    await this.updateExecutionPhase('execution', 'running');
    await this.delay(1500); // Simulate API call to create calendar event
    await this.updateExecutionPhase('execution', 'completed', 'Invites sent via API');

    // Transition to Tracking phase
    await this.updateExecutionPhase('tracking', 'running');
    this.showTrackingWidget();
    this.simulateRsvpUpdates();
  }

  private showTrackingWidget(): void {
    this.trackingWidgetId = buildWidgetId(this.workflowId, 'meeting_tracking', this.widgetIndex++);
    
    // We will build MeetingTrackingWidget to accept this payload
    const payload = {
      title: this.meetingTitle,
      subtitle: MOCK_TIME_SLOTS.find(s => s.id === this.selectedSlotId)?.time + ' on ' + MOCK_TIME_SLOTS.find(s => s.id === this.selectedSlotId)?.date,
      attendees: this.attendees,
      location: 'Google Meet'
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.trackingWidgetId,
      widgetType: 'meeting_tracking' as any, // Temporary cast until we update types.ts
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload,
    });
  }

  private simulateRsvpUpdates(): void {
    let elapsed = 0;
    this.rsvpSimIntervalId = setInterval(() => {
      elapsed += 3000;
      
      if (elapsed === 6000) {
        // First attendee accepts
        this.attendees[0].status = 'accepted';
        this.updateTrackingWidget();
      }

      if (elapsed >= 9000) {
        // All done
        clearInterval(this.rsvpSimIntervalId);
        this.updateExecutionPhase('tracking', 'completed', 'All attendees have RSVPd');
        this.complete();
      }
    }, 3000);
  }

  private updateTrackingWidget(): void {
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.trackingWidgetId,
      widgetType: 'meeting_tracking' as any,
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { attendees: [...this.attendees] },
    });
  }

  // ─── Phase Tracking ───

  private executionPhases: ExecutionPhase[] = [
    { id: 'intent',     label: 'Intent Understood',   status: 'pending' },
    { id: 'sync',       label: 'Calendar Sync',       status: 'pending' },
    { id: 'planning',   label: 'Finding Times',       status: 'pending' },
    { id: 'execution',  label: 'Execution',           status: 'pending' },
    { id: 'tracking',   label: 'Tracking RSVPs',      status: 'pending' },
  ];

  private async updateExecutionPhase(
    phaseId: string,
    status: 'running' | 'completed' | 'failed' | 'pending',
    detail?: string
  ): Promise<void> {
    if (status === 'running') {
      this.phaseStartTimes[phaseId] = Date.now();
    }
    
    let latencyMs: number | undefined;
    if (status === 'completed' || status === 'failed') {
      const start = this.phaseStartTimes[phaseId];
      if (start) {
        latencyMs = Date.now() - start;
      }
    }

    this.executionPhases = this.executionPhases.map(p => 
      p.id === phaseId ? { ...p, status, latencyMs, detail } : p
    );

    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phases: this.executionPhases },
    });
  }

  async pause(): Promise<void> {}
  async resume(): Promise<void> {}

  async cancel(): Promise<void> {
    this.cleanup();
    emitWorkflowUIEvent({
      event: 'WORKFLOW_CANCELLED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'CANCELLED',
      payload: {},
    });
  }

  async rollback(): Promise<void> {}

  async complete(): Promise<void> {
    this.cleanup();
    emitWorkflowUIEvent({
      event: 'WORKFLOW_COMPLETED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'COMPLETED',
      payload: {},
    });
  }

  private cleanup(): void {
    if (this.unsubscribeFn) this.unsubscribeFn();
    if (this.rsvpSimIntervalId) clearInterval(this.rsvpSimIntervalId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export async function triggerCalendarMeeting(conversationId: string, entities: Record<string, unknown> = {}): Promise<string> {
  const workflow = new CalendarMeetingWorkflow();
  const context: WorkflowContext = { conversationId, workflowId: '', intent: 'calendar.meeting', entities };
  
  await workflow.initialize(context);
  workflow.execute(context).catch(console.error);
  
  return (workflow as any).workflowId;
}
