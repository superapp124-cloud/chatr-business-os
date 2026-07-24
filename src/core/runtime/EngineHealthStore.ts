/**
 * Engine Health Store
 * 
 * Aggregates global metrics across the PipelineEngine, EventBus, AIRuntime, and Providers.
 * Subscribes to the EventBus to compute rolling averages and throughput.
 */

import { eventBus } from '@/core/runtime/EventBus';
import { eventRuntime } from '@/core/runtime/EventRuntime';

export interface EngineHealthMetrics {
  activeWorkflows: number;
  runningStages: number;
  queueDepth: number;          // Simulating backlog
  eventThroughput: number;     // events per second
  errorRate: number;           // % of failed stages/workflows
  retryRate: number;           // % of stages requiring retries
  compensationRate: number;    // % of workflows requiring compensation
  
  // Latencies (rolling averages)
  providerLatencyMs: number;
  aiRuntimeLatencyMs: number;
  eventPublishLatencyMs: number;
  
  // Event Runtime Specifics
  dlqCount: number;
  batchFlushCount: number;
  queueSaturation: number;
  
  // Resource Simulation & Real Stats
  memoryUsageMB: number;
  gcPauseEstimateMs: number;
  aiCacheUsageMB: number;
  eventQueueUsageMB: number;
}

export const MEMORY_BUDGETS = {
  workflowRuntimeMB: 50,
  eventRuntimeMB: 25,
  aiRuntimeCacheMB: 256,
  replayBufferMB: 20,
  providerMetadataMB: 5,
};

export interface EngineHealthSnapshot extends EngineHealthMetrics {
  timestamp: number;
}

class EngineHealthStoreImpl {
  private metrics: EngineHealthMetrics = {
    activeWorkflows: 0,
    runningStages: 0,
    queueDepth: 0,
    eventThroughput: 0,
    errorRate: 0,
    retryRate: 0,
    compensationRate: 0,
    providerLatencyMs: 0,
    aiRuntimeLatencyMs: 0,
    eventPublishLatencyMs: 0,
    dlqCount: 0,
    batchFlushCount: 0,
    queueSaturation: 0,
    memoryUsageMB: 0,
    gcPauseEstimateMs: 0,
    aiCacheUsageMB: 0,
    eventQueueUsageMB: 0,
  };

  private history: EngineHealthSnapshot[] = [];

  private listeners: Array<() => void> = [];

  // Internal counters for throughput and averages
  private eventCount10s = 0;
  private totalErrors = 0;
  private totalStages = 0;
  private totalRetries = 0;
  private totalCompensations = 0;
  private totalWorkflows = 0;

  // Rolling averages
  private aiLatencies: number[] = [];
  private providerLatencies: number[] = [];
  private eventLatencies: number[] = [];

  constructor() {
    this.subscribeToEvents();
    this.startMetricsLoop();
  }

  private subscribeToEvents() {
    eventBus.subscribe('*', (e: any) => {
      const start = performance.now();
      this.eventCount10s++;
      
      // Simulate micro-latency tracking for event publish
      const publishLatency = performance.now() - start;
      this.addRollingMetric(this.eventLatencies, publishLatency);
    });

    eventBus.subscribe('PIPELINE_STARTED', () => {
      this.metrics.activeWorkflows++;
      this.totalWorkflows++;
      this.metrics.memoryUsageMB += 0.5; // Simulate memory growth
      this.notify();
    });

    eventBus.subscribe('PIPELINE_COMPLETED', () => {
      this.metrics.activeWorkflows = Math.max(0, this.metrics.activeWorkflows - 1);
      this.metrics.memoryUsageMB = Math.max(124, this.metrics.memoryUsageMB - 0.4);
      this.notify();
    });

    eventBus.subscribe('STAGE_STARTED', () => {
      this.metrics.runningStages++;
      this.totalStages++;
      this.notify();
    });

    eventBus.subscribe('STAGE_COMPLETED', (e: any) => {
      const p = e.payload || e;
      this.metrics.runningStages = Math.max(0, this.metrics.runningStages - 1);
      if (p.latencyMs) this.addRollingMetric(this.providerLatencies, p.latencyMs);
      this.notify();
    });

    eventBus.subscribe('STAGE_FAILED', () => {
      this.metrics.runningStages = Math.max(0, this.metrics.runningStages - 1);
      this.totalErrors++;
      this.notify();
    });

    eventBus.subscribe('COMPENSATION_STARTED', () => {
      this.totalCompensations++;
      this.notify();
    });

    // We simulate AI Runtime events since we don't have explicit hook points in all providers yet
    eventBus.subscribe('AI_INFERENCE_COMPLETED', (e: any) => {
      const p = e.payload || e;
      if (p.overheadMs) this.addRollingMetric(this.aiLatencies, p.overheadMs);
    });
  }

  private addRollingMetric(arr: number[], val: number) {
    arr.push(val);
    if (arr.length > 50) arr.shift(); // Keep last 50
  }

  private getAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private startMetricsLoop() {
    setInterval(() => {
      // Calculate throughput (events over 10s window divided by 10)
      this.metrics.eventThroughput = this.eventCount10s / 10;
      this.eventCount10s = 0; // reset window

      // Calculate rates
      this.metrics.errorRate = this.totalStages > 0 ? (this.totalErrors / this.totalStages) * 100 : 0;
      this.metrics.retryRate = this.totalStages > 0 ? (this.totalRetries / this.totalStages) * 100 : 0;
      this.metrics.compensationRate = this.totalWorkflows > 0 ? (this.totalCompensations / this.totalWorkflows) * 100 : 0;

      // Calculate rolling latencies
      this.metrics.aiRuntimeLatencyMs = this.getAverage(this.aiLatencies);
      this.metrics.providerLatencyMs = this.getAverage(this.providerLatencies);
      this.metrics.eventPublishLatencyMs = this.getAverage(this.eventLatencies);

      // Simulate minor queue depth fluctuation based on active workflows
      this.metrics.queueDepth = Math.max(0, this.metrics.activeWorkflows * 2 + Math.floor(Math.random() * 5 - 2));

      // Sync with Event Runtime metrics
      this.metrics.dlqCount = eventRuntime.metrics.dlqCount;
      this.metrics.batchFlushCount = eventRuntime.metrics.batchFlushCount;
      this.metrics.queueSaturation = eventRuntime.metrics.queueSaturation;

      // Memory Polling & Budget Enforcement
      this.pollMemory();

      // Append to history for charts
      this.history.push({ ...this.metrics, timestamp: Date.now() });
      if (this.history.length > 60) this.history.shift(); // Keep last 2 minutes if ticking every 2s

      this.notify();
    }, 2000); // Update rates every 2 seconds
  }

  private pollMemory() {
    // 1. Measure actual JS Heap if available (Chrome/Edge/Electron)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      this.metrics.memoryUsageMB = mem.usedJSHeapSize / (1024 * 1024);
    } else {
      // Simulate memory baseline if API missing
      this.metrics.memoryUsageMB = 100 + (this.metrics.activeWorkflows * 0.5) + (this.metrics.queueDepth * 0.1);
    }

    // 2. Estimate subsystem usage (Simulated for this milestone)
    this.metrics.eventQueueUsageMB = (this.metrics.queueDepth * 1.5) / 1024; // ~1.5kb per event
    
    // 3. Emit MEMORY_WARNING if global or specific budgets cross 80%
    const totalBudget = Object.values(MEMORY_BUDGETS).reduce((a, b) => a + b, 0);
    if (this.metrics.memoryUsageMB > totalBudget * 0.8) {
      eventBus.publish('MEMORY_WARNING', { 
        usageMB: this.metrics.memoryUsageMB, 
        thresholdMB: totalBudget * 0.8 
      }, { priority: 'critical' });
    }
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  public getMetrics(): EngineHealthMetrics {
    return { ...this.metrics };
  }

  public getHistory(): EngineHealthSnapshot[] {
    return [...this.history];
  }
}

export const engineHealthStore = new EngineHealthStoreImpl();
