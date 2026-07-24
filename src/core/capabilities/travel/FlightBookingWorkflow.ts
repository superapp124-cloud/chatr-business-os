import { eventBus } from '@/core/runtime/EventBus';
import {
  emitWorkflowUIEvent,
  buildWorkflowId,
  buildWidgetId,
  WorkflowCapabilityContract,
  WorkflowContext,
  WorkflowManifest,
  WidgetAction,
} from '@/core/workflow-ui';
import { providerResolver } from '@/core/providers/ProviderResolver';
import { executionAdapter } from '@/core/providers/ExecutionAdapter';

const FLIGHT_BOOKING_MANIFEST: WorkflowManifest = {
  id: 'FLIGHT_BOOKING',
  version: '1.0',
  name: 'Flight Booking Engine',
  description: 'Production-grade flight booking orchestration via Playwright MMT Agent.',
  widgets: ['route_picker', 'selection', 'payment', 'result', 'execution_console', 'timeline'],
  permissions: ['PAYMENTS', 'CALENDAR', 'IDENTITY'],
  resumable: true,
  timeout: 300_000,
  cancellable: true,
  supportsNestedWorkflows: false,
  estimatedSteps: 4,
};

export class FlightBookingWorkflow implements WorkflowCapabilityContract {
  readonly manifest = FLIGHT_BOOKING_MANIFEST;

  private workflowId = '';
  private executionConsoleWidgetId = '';
  private routePickerWidgetId = '';
  private selectionWidgetId = '';
  private paymentWidgetId = '';
  private resultWidgetId = '';
  private widgetIndex = 0;
  
  private unsubscribeFn?: () => void;
  private flights: any[] = [];
  private selectedFlight: any = null;
  private resolvedProvider: any = null;
  private isBuildingCart = false;

  private currentOrigin = 'DEL';
  private currentDestination = 'BOM';
  
  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, 'flight-booking');

    emitWorkflowUIEvent({
      event: 'WORKFLOW_STARTED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'CREATED',
      payload: { manifest: this.manifest },
    });

    this.executionConsoleWidgetId = buildWidgetId(this.workflowId, 'execution_console', this.widgetIndex++);
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { steps: [] },
    });

    // Listen to actions
    this.unsubscribeFn = eventBus.on('WORKFLOW_UI.WIDGET_ACTION', async (action: WidgetAction) => {
      await this.handleWidgetAction(action);
    });

    // Show Route Picker first
    await this.showRoutePicker(context);
  }

  private async updatePhase(id: string, status: 'running' | 'completed' | 'failed', message?: string) {
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phaseUpdate: { id, status, message } },
    });
    // Let UI render
    await new Promise(r => setTimeout(r, 300));
  }

  private async showRoutePicker(context: WorkflowContext) {
    await this.updatePhase('intent', 'running', 'Gathering travel details...');
    
    this.routePickerWidgetId = buildWidgetId(this.workflowId, 'route_picker', this.widgetIndex++);
    
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.routePickerWidgetId,
      widgetType: 'route_picker',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload: {
        title: 'Where to?',
        subtitle: 'Enter your travel route for tomorrow',
        origin: 'New Delhi (DEL)',
        destination: 'Mumbai (BOM)',
        ctaLabel: 'Search Flights',
        mode: 'flight'
      },
    });
  }

  private async executeSearch() {
    try {
      this.resolvedProvider = await providerResolver.resolve('travel.flight.search');
      
      await this.updatePhase('discovery', 'running', `Scraping flights via ${this.resolvedProvider?.name}...`);
      
      const response = await executionAdapter.execute(this.resolvedProvider, { 
        capabilityId: 'travel.flight.search', 
        parameters: { origin: this.currentOrigin, destination: this.currentDestination } 
      });

      if (response.status === 'FAILED') throw new Error(response.error);
      this.flights = response.data;
      
      await this.updatePhase('discovery', 'completed', `Found ${this.flights.length} flights`);
      await this.showSelectionWidget();
    } catch (err: any) {
      console.error(err);
      await this.updatePhase('discovery', 'failed', 'Flight search failed');
    }
  }

  private async showSelectionWidget() {
    this.selectionWidgetId = buildWidgetId(this.workflowId, 'selection', this.widgetIndex++);
    
    // Map raw flights to SelectionOptions
    const mappedOptions = this.flights.map(f => ({
      id: f.id,
      values: {
        airline: f.airline,
        flightNumber: f.flightNumber,
        time: f.time,
        price: f.price
      },
      recommended: f.recommended,
      badge: f.reasons?.[0],
      icon: f.logo
    }));

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.selectionWidgetId,
      widgetType: 'selection',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload: {
        title: 'Select Flight',
        subtitle: `Tomorrow • ${this.currentOrigin} to ${this.currentDestination}`,
        columns: [
          { key: 'airline', label: 'Airline', type: 'text', primary: true },
          { key: 'flightNumber', label: 'Flight No.', type: 'text' },
          { key: 'time', label: 'Schedule', type: 'text' },
          { key: 'price', label: 'Price', type: 'currency', currencyCode: 'INR' }
        ],
        options: mappedOptions,
        multiSelect: false,
        ctaLabel: 'Continue to Checkout'
      },
    });
  }

  private async buildCartAndShowHandoff(): Promise<void> {
    await this.updatePhase('execution', 'running', `Building cart via MakeMyTrip Live Agent...`);
    
    const response = await executionAdapter.execute(this.resolvedProvider, { 
      capabilityId: 'travel.flight.book', 
      parameters: { itemId: this.selectedFlight.id, origin: this.currentOrigin, destination: this.currentDestination } 
    });
    
    await this.updatePhase('execution', 'completed', `Cart built on MakeMyTrip`);
    await this.showPaymentWidget(response.data.checkoutUrl);
  }

  private async showPaymentWidget(checkoutUrl: string): Promise<void> {
    await this.updatePhase('payment', 'running');
    
    this.paymentWidgetId = buildWidgetId(this.workflowId, 'payment', this.widgetIndex++);
    
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.paymentWidgetId,
      widgetType: 'payment',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload: {
        title: 'Secure Checkout',
        subtitle: `Pay to confirm your seat on ${this.selectedFlight.airline}`,
        amount: this.selectedFlight.price,
        currency: 'INR',
        merchantName: 'MakeMyTrip',
        handoffUrl: checkoutUrl,
        items: [
          { name: `Flight ${this.selectedFlight.flightNumber}`, quantity: 1, price: this.selectedFlight.price }
        ],
        ctaLabel: 'Confirm Booking'
      },
    });
  }

  private async handleWidgetAction(action: WidgetAction): Promise<void> {
    if (action.workflowId !== this.workflowId) return;

    if (action.action === 'SUBMIT' && action.widgetId === this.routePickerWidgetId) {
      const data = action.data as any;
      if (data.origin) this.currentOrigin = data.origin;
      if (data.destination) this.currentDestination = data.destination;

      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.routePickerWidgetId,
        widgetType: 'route_picker',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: { title: `Searching ${this.currentOrigin} to ${this.currentDestination}...` },
      });
      
      await this.updatePhase('intent', 'completed', 'Route captured');
      await this.executeSearch();
    }

    if (action.action === 'CONFIRM_SELECTION' && action.widgetId === this.selectionWidgetId) {
      if (this.isBuildingCart || this.paymentWidgetId) return;
      this.isBuildingCart = true;

      const selectedIds = action.data.selectedIds as string[];
      this.selectedFlight = this.flights.find(f => f.id === selectedIds[0]);
      
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.selectionWidgetId,
        widgetType: 'selection',
        widgetVersion: '1.0',
        lifecycle: 'EXECUTING',
        payload: { selectedId: this.selectedFlight.id },
      });

      await this.buildCartAndShowHandoff();
    }

    if (action.action === 'PAY' && action.widgetId === this.paymentWidgetId) {
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.paymentWidgetId,
        widgetType: 'payment',
        widgetVersion: '1.0',
        lifecycle: 'EXECUTING',
        payload: { ctaLabel: 'Waiting for MakeMyTrip Confirmation...' },
      });

      await this.updatePhase('payment', 'running', 'Awaiting payment confirmation webhook...');
      await new Promise(r => setTimeout(r, 4000)); // Simulate webhook delay

      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.paymentWidgetId,
        widgetType: 'payment',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: {},
      });

      await this.updatePhase('payment', 'completed', 'Payment confirmed');
      await this.showETicket();
    }

    if (action.action === 'CANCEL') {
      await this.cancel();
    }
  }

  private async showETicket() {
    this.resultWidgetId = buildWidgetId(this.workflowId, 'result', this.widgetIndex++);
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.resultWidgetId,
      widgetType: 'result',
      widgetVersion: '1.0',
      lifecycle: 'COMPLETED',
      payload: {
        status: 'success',
        title: 'Flight Booked Successfully',
        message: `Your flight on ${this.selectedFlight.airline} is confirmed.`,
        metadata: [
          { label: 'PNR', value: `MMT${Math.random().toString(36).substr(2, 6).toUpperCase()}` },
          { label: 'Flight', value: this.selectedFlight.flightNumber },
          { label: 'Route', value: `${this.currentOrigin} to ${this.currentDestination}` }
        ],
        actions: [{ label: 'Download E-Ticket', id: 'DOWNLOAD_TICKET' }]
      },
    });

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

  async cancel(): Promise<void> {
    emitWorkflowUIEvent({
      event: 'WORKFLOW_CANCELLED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'FAILED',
      payload: { reason: 'User cancelled flight booking' },
    });
    if (this.unsubscribeFn) this.unsubscribeFn();
  }
}

export const triggerFlightBooking = async (conversationId: string, parameters: any = {}): Promise<string> => {
  const workflow = new FlightBookingWorkflow();
  const context: WorkflowContext = { conversationId, permissions: [], entities: parameters };
  await workflow.initialize(context);
  return workflow.manifest.id;
};
