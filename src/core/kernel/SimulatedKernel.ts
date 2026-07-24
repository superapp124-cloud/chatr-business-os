import { KernelSession, KernelSessionEvent, IntentContext, MetricEvent } from './KernelSession';

export class SimulatedKernel implements KernelSession {
  private subscribers: Array<(event: KernelSessionEvent) => void> = [];
  private context: IntentContext;
  private timeouts: NodeJS.Timeout[] = [];

  constructor() {
    this.context = {
      intent: '',
      metrics: {},
      tasksCompleted: {}
    };
  }

  subscribe(callback: (event: KernelSessionEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private emit(event: KernelSessionEvent) {
    this.subscribers.forEach(cb => cb(event));
  }

  private recordMetric(stage: string, startedAt: number, finishedAt: number, slaMs: number) {
    const metric: MetricEvent = {
      stage,
      startedAt,
      finishedAt,
      latencyMs: finishedAt - startedAt,
      slaMs
    };
    if (!this.context.metrics) this.context.metrics = {};
    this.context.metrics[stage] = metric;
    this.emit({ type: 'METRIC_RECORDED', metric, context: { ...this.context } });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      const t = setTimeout(resolve, ms);
      this.timeouts.push(t);
    });
  }

  async submitIntent(intent: string): Promise<void> {
    this.context = { intent, metrics: {}, tasksCompleted: {} };
    this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: { ...this.context } });

    const startTime = Date.now();

    // PARALLEL EXECUTION (Aggressive SLA: 300-500ms total)

    // Task 1: Understanding (< 50ms)
    const understandingTask = this.delay(40).then(() => {
      this.context.extractedEntities = ['Food', 'Chicken Biryani'];
      this.context.tasksCompleted!.understanding = true;
      this.recordMetric('Understanding', startTime, Date.now(), 50);
      this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: { ...this.context } });
    });

    // Task 2: Location (< 100ms)
    const locationTask = this.delay(80).then(() => {
      this.context.location = 'Sector 128, Noida';
      this.context.tasksCompleted!.location = true;
      this.recordMetric('Location', startTime, Date.now(), 100);
      this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: { ...this.context } });
    });

    // Task 3: Provider Search (< 300ms)
    const searchTask = this.delay(280).then(() => {
      this.context.providersSearched = ['Zomato', 'Swiggy', 'Magicpin', 'Direct restaurants'];
      this.context.resultsFound = 47;
      this.context.resultsEliminated = 39;
      this.context.tasksCompleted!.providerSearch = true;
      this.recordMetric('ProviderSearch', startTime, Date.now(), 300);
      this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: { ...this.context } });
    });

    // Task 4: Session Check (< 50ms)
    const sessionTask = this.delay(30).then(() => {
      this.context.tasksCompleted!.sessionCheck = true;
      this.recordMetric('SessionCheck', startTime, Date.now(), 50);
      this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: { ...this.context } });
    });

    // Task 5: Payment Readiness (< 100ms)
    const paymentTask = this.delay(90).then(() => {
      this.context.tasksCompleted!.paymentReadiness = true;
      this.recordMetric('PaymentReadiness', startTime, Date.now(), 100);
      this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: { ...this.context } });
    });

    // Wait for all pre-ranking tasks to finish (Max ~280ms)
    await Promise.all([understandingTask, locationTask, searchTask, sessionTask, paymentTask]);

    // Ranking Engine (< 50ms)
    const rankingStart = Date.now();
    await this.delay(40);
    
    this.context.topResults = [
      {
        id: 'res_behrouz',
        name: 'Behrouz',
        badge: 'Best Overall',
        price: '₹289',
        deliveryTime: '28 min',
        rating: '4.6★',
        tags: ['Free Delivery', "Today's Offer"],
        decisionReasons: ['Highest rating', 'Recommended because you ordered biryani last month']
      },
      {
        id: 'res_blues',
        name: 'Biryani Blues',
        badge: 'Best Value',
        price: '₹249',
        deliveryTime: '31 min',
        rating: '4.5★',
        tags: ['Free Delivery'],
        decisionReasons: ['Good value', 'Lowest delivery fee']
      },
      {
        id: 'res_paradise',
        name: 'Paradise',
        badge: 'Fastest',
        price: '₹319',
        deliveryTime: '24 min',
        rating: '4.7★',
        tags: [],
        decisionReasons: ['Fastest arrival', 'Available now']
      }
    ];

    this.recordMetric('Ranking', rankingStart, Date.now(), 50);
    this.recordMetric('Total_Intent_To_Results', startTime, Date.now(), 500);

    // Results Ready! (~320-350ms total)
    this.emit({ type: 'STATE_CHANGED', state: 'results_ready', context: { ...this.context } });
  }

  async selectOption(resultId: string): Promise<void> {
    const selected = this.context.topResults?.find(r => r.id === resultId);
    if (selected) {
      this.context.selectedResult = selected;
    }
    
    this.emit({ type: 'STATE_CHANGED', state: 'connecting', context: { ...this.context } });

    // Since session check was speculative and succeeded (assuming returning user)
    // 0ms Authentication delay!
    await this.delay(50); 
    
    this.emit({ type: 'STATE_CHANGED', state: 'review', context: { ...this.context } });
  }

  async completeAuth(): Promise<void> {
    // Only used for cold login
    this.emit({ type: 'STATE_CHANGED', state: 'auth_complete', context: { ...this.context } });
    await this.delay(300);
    this.emit({ type: 'STATE_CHANGED', state: 'review', context: { ...this.context } });
  }

  async confirmAndPay(): Promise<void> {
    this.emit({ type: 'STATE_CHANGED', state: 'paying', context: { ...this.context } });

    await this.delay(800); // Super fast payment processing
    this.emit({ type: 'STATE_CHANGED', state: 'tracking', context: { ...this.context } });

    await this.delay(4000); // Simulating time skip to delivery
    this.emit({ type: 'STATE_CHANGED', state: 'completed', context: { ...this.context } });
  }

  destroy() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
    this.subscribers = [];
  }
}
