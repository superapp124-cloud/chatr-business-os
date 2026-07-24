import { eventBus } from '@/core/runtime/EventBus';
import {
  emitWorkflowUIEvent,
  buildWorkflowId,
  buildWidgetId,
  WorkflowCapabilityContract,
  WorkflowContext,
  WorkflowManifest,
  SelectionWidgetPayload,
  PaymentWidgetPayload,
  TrackingWidgetPayload,
  WidgetAction,
} from '@/core/workflow-ui';
import type { ExecutionConsoleWidgetPayload, ExecutionPhase } from '@/core/workflow-ui/types';
import { providerResolver } from '@/core/providers/ProviderResolver';
import { executionAdapter } from '@/core/providers/ExecutionAdapter';

// ─── Manifest ─────────────────────────────────────────────────────────────────

const FOOD_ORDERING_MANIFEST: WorkflowManifest = {
  id: 'FOOD_ORDERING',
  version: '1.0',
  name: 'Order Food',
  description: 'Order food with price comparison and live tracking',
  widgets: ['selection', 'payment', 'tracking', 'execution_console', 'timeline'],
  permissions: ['LOCATION', 'PAYMENTS'],
  resumable: true,
  timeout: 300_000,
  cancellable: true,
  supportsNestedWorkflows: false,
  estimatedSteps: 4,
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

// MOCK_RESTAURANTS removed - routing through Provider OS

const MOCK_DRIVER = {
  agentName: 'Ramesh Singh',
  agentRating: 4.9,
  agentVehicle: 'Honda Activa',
  agentPlate: 'KA 01 HG 1234',
  otp: '8492',
  eta: '25 min',
};

// ─── FoodOrderingWorkflow ─────────────────────────────────────────────────────

export class FoodOrderingWorkflow implements WorkflowCapabilityContract {
  readonly manifest = FOOD_ORDERING_MANIFEST;

  private workflowId = '';
  private executionConsoleWidgetId = '';
  private timelineWidgetId = '';
  private selectionWidgetId = '';
  private paymentWidgetId = '';
  private trackingWidgetId = '';
  private widgetIndex = 0;
  private unsubscribeFn?: () => void;
  private selectedRestaurantId: string | null = null;
  private driverSimIntervalId?: ReturnType<typeof setInterval>;
  private phaseStartTimes: Record<string, number> = {};
  private resolvedProvider: any = null;
  private discoveredOptions: any[] = [];
  private locationWidgetId = '';
  private userAddress = '';
  private isBuildingCart = false;
  
  // State
  private foodItem = '';

  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, 'food-ordering');
    this.foodItem = (context.entities?.foodItem as string) || 'Pizza';

    emitWorkflowUIEvent({
      event: 'WORKFLOW_STARTED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
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
        { id: 'location',   label: 'Location Verified',   status: 'pending' },
        { id: 'discovery',  label: 'Finding Restaurants', status: 'pending' },
        { id: 'payment',    label: 'Payment',             status: 'pending' },
        { id: 'execution',  label: 'Placing Order',       status: 'pending' },
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

    this.unsubscribeFn = eventBus.on<WidgetAction>(
      'FOOD_ORDERING.WIDGET_ACTION',
      (kernelEvent) => this.handleWidgetAction(kernelEvent.payload)
    );
  }

  async execute(context: WorkflowContext): Promise<void> {
    // 1. Intent Understood
    await this.delay(800);
    await this.updateExecutionPhase('intent', 'completed', `Identified request for ${this.foodItem}`);

    // 1.5 Verify Location
    const savedAddress = localStorage.getItem('chatr_saved_address');
    if (savedAddress) {
      this.userAddress = savedAddress;
      const savedLabel = localStorage.getItem('chatr_saved_address_label') || 'Address';
      await this.updateExecutionPhase('location', 'completed', `Loaded from Memory: ${savedLabel}`);
      await this.runDiscovery();
    } else {
      await this.updateExecutionPhase('location', 'running');
      await this.showLocationWidget();
    }
  }

  private async showLocationWidget(): Promise<void> {
    this.locationWidgetId = buildWidgetId(this.workflowId, 'form', this.widgetIndex++);
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.locationWidgetId,
      widgetType: 'form',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload: {
        title: 'Confirm Delivery Location',
        subtitle: 'Please provide your precise address',
        fields: [
          { id: 'address', label: 'Complete Address', type: 'text', placeholder: 'Flat, Floor, Building Name', required: true },
          { id: 'label', label: 'Save As', type: 'choice', options: ['Home', 'Work', 'Other'], required: true }
        ],
        ctaLabel: 'Confirm Location'
      }
    });
  }


  private async handleWidgetAction(action: WidgetAction): Promise<void> {
    if (action.workflowId !== this.workflowId) return;

    if (action.action === 'SUBMIT' && action.widgetId === this.locationWidgetId) {
      const values = action.data.values as Record<string, unknown>;
      this.userAddress = values?.address as string;
      const label = values?.label as string;

      localStorage.setItem('chatr_saved_address', this.userAddress);
      localStorage.setItem('chatr_saved_address_label', label);

      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.locationWidgetId,
        widgetType: 'form',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: { title: `Saved as ${label}` },
      });

      await this.updateExecutionPhase('location', 'completed', `Saved ${label} to Memory`);
      await this.runDiscovery();
    }

    if (action.action === 'CONFIRM_SELECTION' && action.widgetId === this.selectionWidgetId) {
      if (this.isBuildingCart || this.paymentWidgetId) return; // Prevent double execution if user spams the button
      this.isBuildingCart = true;
      const selectedIds = action.data.selectedIds as string[];
      this.selectedRestaurantId = selectedIds[0];
      
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.selectionWidgetId,
        widgetType: 'selection',
        widgetVersion: '1.0',
        lifecycle: 'EXECUTING', // Set to EXECUTING to disable UI interactions while cart builds
        payload: { selectedId: this.selectedRestaurantId },
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
        payload: { ctaLabel: 'Waiting for Zomato Confirmation...' },
      });

      await this.updateExecutionPhase('payment', 'running', 'Awaiting payment confirmation from Zomato...');
      await this.delay(5000); // Wait 5 seconds to simulate webhook delay

      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.paymentWidgetId,
        widgetType: 'payment',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: {},
      });

      await this.executeOrder();
    }

    if (action.action === 'CANCEL') {
      await this.cancel();
    }
  }

  private async runDiscovery(): Promise<void> {
    await this.updateExecutionPhase('discovery', 'running');
    
    this.resolvedProvider = await providerResolver.resolve('commerce.food.search');
    if (!this.resolvedProvider) {
       await this.updateExecutionPhase('discovery', 'failed', 'No food delivery providers available');
       return;
    }
    
    await this.updateExecutionPhase('discovery', 'running', `Resolved via ${this.resolvedProvider.name}`);

    const response = await executionAdapter.execute(this.resolvedProvider, { 
       capabilityId: 'commerce.food.search', 
       parameters: { foodItem: this.foodItem, location: this.userAddress } 
    });

    if (response.status === 'FAILED') throw new Error(response.error);
    this.discoveredOptions = response.data;
    
    await this.updateExecutionPhase('discovery', 'completed', `Found ${this.discoveredOptions.length} options`);

    // Pauses here to show Selection
    await this.showSelectionWidget();
  }

  private async showSelectionWidget(): Promise<void> {
    this.selectionWidgetId = buildWidgetId(this.workflowId, 'selection', this.widgetIndex++);
    const payload: SelectionWidgetPayload = {
      title: `Top Rated ${this.foodItem}`,
      subtitle: 'Based on your preferences',
      columns: [
        { key: 'name', label: 'Restaurant', type: 'text', primary: true },
        { key: 'eta', label: 'Delivery Time', type: 'duration' },
        { key: 'rating', label: 'Rating', type: 'rating' },
        { key: 'price', label: 'Price', type: 'currency', currencyCode: 'INR' },
        { key: 'status', label: '', type: 'badge' }
      ],
      options: this.discoveredOptions.map(r => ({
        id: r.id,
        icon: r.logo,
        values: { name: r.restaurant, eta: r.time, rating: String(r.rating), price: r.price, status: r.recommended ? 'Best Choice' : undefined },
        recommended: r.recommended,
        badge: r.recommended ? 'Best Match' : undefined,
        badgeVariant: r.recommended ? 'success' : undefined
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

  private async buildCartAndShowHandoff(): Promise<void> {
    await this.updateExecutionPhase('execution', 'running', `Building cart via ${this.resolvedProvider?.name}...`);
    
    const response = await executionAdapter.execute(this.resolvedProvider, { 
      capabilityId: 'commerce.food.order', 
      parameters: { itemId: this.selectedRestaurantId, location: this.userAddress } 
    });
    
    await this.updateExecutionPhase('execution', 'completed', `Cart built on Zomato`);

    await this.showPaymentWidget(response.data.checkoutUrl);
  }

  private async showPaymentWidget(checkoutUrl: string): Promise<void> {
    await this.updateExecutionPhase('payment', 'running');
    
    this.paymentWidgetId = buildWidgetId(this.workflowId, 'payment', this.widgetIndex++);
    const restaurant = this.discoveredOptions.find(r => r.id === this.selectedRestaurantId);
    console.log('[FoodOrderingWorkflow] selectedRestaurantId:', this.selectedRestaurantId);
    console.log('[FoodOrderingWorkflow] discoveredOptions:', this.discoveredOptions);
    console.log('[FoodOrderingWorkflow] found restaurant:', restaurant);

    const restaurantName = restaurant?.restaurant || restaurant?.name || 'Selected Restaurant';

    const payload: PaymentWidgetPayload = {
      title: `Order from ${restaurantName}`,
      amount: restaurant?.price || 450,
      currencyCode: 'INR',
      breakdown: [
        { label: 'Item Total', amount: (restaurant?.price || 450) - 50, type: 'subtotal' },
        { label: 'Delivery Fee', amount: 40, type: 'fee' },
        { label: 'Taxes', amount: 10, type: 'fee' },
      ],
      checkoutUrl,
      ctaLabel: 'Complete Payment on Zomato'
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.paymentWidgetId,
      widgetType: 'payment',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload,
    });
  }

  private async executeOrder(): Promise<void> {
    await this.updateExecutionPhase('payment', 'completed', 'Payment Successful');
    
    // Transition to Tracking phase
    await this.updateExecutionPhase('tracking', 'running');
    this.showTrackingWidget();
    this.simulateDeliveryUpdates();
  }

  private showTrackingWidget(): void {
    this.trackingWidgetId = buildWidgetId(this.workflowId, 'tracking', this.widgetIndex++);
    const restaurant = MOCK_RESTAURANTS.find(r => r.id === this.selectedRestaurantId);
    
    const payload: TrackingWidgetPayload = {
      title: 'Food is being prepared',
      status: 'Cooking',
      providerName: restaurant?.name || 'Restaurant',
      agentName: MOCK_DRIVER.agentName,
      agentRating: MOCK_DRIVER.agentRating,
      agentVehicle: MOCK_DRIVER.agentVehicle,
      agentPlate: MOCK_DRIVER.agentPlate,
      otp: MOCK_DRIVER.otp,
      eta: restaurant?.eta || MOCK_DRIVER.eta,
      origin: restaurant?.name || 'Restaurant',
      destination: 'Home',
      showMap: true,
      driverProgress: 0,
      driverDistance: 'At restaurant',
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

  private simulateDeliveryUpdates(): void {
    let progress = 0;
    this.driverSimIntervalId = setInterval(() => {
      progress += 0.2;
      
      let status = 'On the way';
      let title = 'Out for delivery';
      let distance = '2.4 km away';

      if (progress >= 0.2 && progress < 0.5) {
        status = 'On the way'; distance = '1.8 km away';
      } else if (progress >= 0.5 && progress < 0.8) {
        status = 'Nearby'; distance = '800m away';
      } else if (progress >= 0.8 && progress < 1.0) {
        status = 'Arriving'; distance = '100m away'; title = 'Delivery partner has arrived';
      }

      if (progress >= 1.0) {
        progress = 1.0;
        status = 'Delivered';
        title = 'Enjoy your meal!';
        distance = 'Delivered';
        clearInterval(this.driverSimIntervalId);
      }

      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.trackingWidgetId,
        widgetType: 'tracking',
        widgetVersion: '1.0',
        lifecycle: progress >= 1.0 ? 'COMPLETED' : 'ACTIVE',
        payload: { driverProgress: progress, status, title, driverDistance: distance },
      });

      if (progress >= 1.0) {
        this.updateExecutionPhase('tracking', 'completed', 'Food delivered successfully');
        this.complete();
      }
    }, 2500);
  }

  // ─── Phase Tracking ───

  private executionPhases: ExecutionPhase[] = [
    { id: 'intent',     label: 'Intent Understood',   status: 'pending' },
    { id: 'discovery',  label: 'Finding Restaurants', status: 'pending' },
    { id: 'payment',    label: 'Payment',             status: 'pending' },
    { id: 'execution',  label: 'Placing Order',       status: 'pending' },
    { id: 'tracking',   label: 'Live Tracking',       status: 'pending' },
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
    if (this.driverSimIntervalId) clearInterval(this.driverSimIntervalId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export async function triggerFoodOrdering(conversationId: string, entities: Record<string, unknown> = {}): Promise<string> {
  const workflow = new FoodOrderingWorkflow();
  const context: WorkflowContext = { conversationId, workflowId: '', intent: 'commerce.food', entities };
  
  await workflow.initialize(context);
  workflow.execute(context).catch(console.error);
  
  return (workflow as any).workflowId;
}
