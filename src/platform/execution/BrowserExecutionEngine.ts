/**
 * BrowserExecutionEngine — Phase A.5
 *
 * A pre-configured ExecutionEngine for the Studio/Browser environment.
 * Plugs in the BrowserNodeRegistry and routes events to the global EventBus.
 */

import { ExecutionEngine } from './ExecutionEngine';
import { BrowserNodeRegistry } from './BrowserNodeRegistry';
import { EventBus } from '../AutomationOS/EventBus';
import type { IExecutionEventPublisher, ExecutionEvent } from '../contracts/ExecutionEvent.abi';
import type { IAuditStore, AuditEvent } from '../contracts/AuditEvent.abi';
import type { IPolicyEngine, PolicyEvaluationResult } from '../contracts/PolicyContract.abi';

const eventPublisher: IExecutionEventPublisher = {
  publish: (event: ExecutionEvent) => {
    // Bridge to old EventBus for Studio UI compatibility
    EventBus.publish({
      type: event.type as any,
      payload: (event as any).payload || {},
      timestamp: Date.now(),
    });
  },
  subscribe: () => { return () => {}; }
};

const auditStore: IAuditStore = {
  async append(event: Omit<AuditEvent, 'id' | 'occurredAt'>) {
    console.log('[Audit] Appended:', event);
  },
  async query() { return []; }
};

const policyEngine: IPolicyEngine = {
  async evaluate() { return []; }
};

export const SharedNodeRegistry = new BrowserNodeRegistry();

export const BrowserExecutionEngine = new ExecutionEngine(
  SharedNodeRegistry,
  eventPublisher,
  auditStore,
  policyEngine,
  { schedulerConfig: { maxConcurrency: 4, failFast: false } }
);
