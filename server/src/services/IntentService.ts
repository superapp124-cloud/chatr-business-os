import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { ExecutionContext } from '../types.js';

// Pipeline Components
import { IntentEngine } from '../kernel/intent/IntentEngine.js';
import { CapabilitySearch } from '../kernel/intent/CapabilitySearch.js';
import { WorkflowSelector } from '../kernel/intent/WorkflowSelector.js';
import { DependencyResolver } from '../kernel/execution/DependencyResolver.js';
import { ExecutionPlanBuilder } from '../kernel/execution/ExecutionPlanBuilder.js';
import { GlobalPlannerCache } from '../kernel/execution/PlannerCache.js';
import { PlannerConfidence } from '../kernel/execution/PlannerConfidence.js';
import { PlannerPolicy } from '../kernel/execution/PlannerPolicy.js';

import { SystemWorkflowEngine } from './WorkflowService.js';
import { ObservationEngine } from '../kernel/execution/ObservationEngine.js';
import { OutcomeTracker } from '../kernel/execution/OutcomeTracker.js';
import { EventDispatcher } from '../kernel/events/EventDispatcher.js';
import { Logger } from '../kernel/observability/SystemLogger.js';
import { TelemetryEngine } from '../kernel/observability/TelemetryEngine.js';
import { TenantScheduler } from '../kernel/tenant/TenantScheduler.js';
import { TenantContextManager } from '../kernel/tenant/TenantContextManager.js';



export class SystemIntentService {
  /**
   * The single entry point for the V1.0 Intent Operating System.
   * Orchestrates the ExecutionContext through the strict pipeline.
   */
  async resolveIntent(
    rawText: string, 
    userId: string, 
    tenantId: string,
    departmentContext?: string,
    externalTraceId?: string
  ) {
    const rootTraceId = externalTraceId || randomUUID();
    
    Logger.info(`V1.0 Pipeline initializing for intent: "${rawText}"`, { 
      source: 'IntentService',
      trace: { traceId: rootTraceId, spanId: randomUUID() },
      userId,
      tenantId
    });

    // 2. Initialize the ExecutionContext (The core OS Process)
    const traceSpanId = randomUUID();
    let context: ExecutionContext = {
      id: randomUUID(),
      trace: {
        traceId: rootTraceId,
        spanId: traceSpanId,
        correlationId: rootTraceId
      },
      rawInput: rawText,
      tenant: {
        tenantId,
        organizationId: 'org-default',
        workspaceId: 'workspace-default',
        userId,
        roles: ['user'],
        permissions: ['*'],
        plan: 'Starter',
        quotas: {
          concurrentWorkflows: 10,
          intentsPerMinute: 60,
          eventsPerSecond: 100,
          storageGb: 5,
          aiTokensPerDay: 10000,
          mcpRequestsPerDay: 1000
        },
        enabledCapabilities: ['lead_tracker']
      },
      departmentId: departmentContext,
      locale: 'en-US',
      timezone: 'UTC',
      state: 'Created',
      completedSteps: [],
      observations: [],
      metadata: {}
    };

    return TenantContextManager.runWithinContext(context, async () => {
      try {
        // ─── THE INTENT PIPELINE ───
        // 1. Emitting Intent Created
        await EventDispatcher.dispatch({
          eventType: 'intent.created',
          streamId: context.id,
          sequence: 1,
          actorId: context.tenant.userId,
          tenantId: context.tenant.tenantId,
          source: 'IntentService',
          correlationId: context.trace.correlationId,
          payload: { rawInput: rawText }
        });

        context = await TelemetryEngine.withSpan('intent.parsing', context.trace, { tenantId: context.tenant.tenantId }, async (spanTrace) => {
          context.resolvedIntent = await IntentEngine.parse(rawText, !!process.env.VITEST);
          context.trace = spanTrace;
          return context;
        });
        
        await EventDispatcher.dispatch({
          eventType: 'intent.parsed',
          streamId: context.id,
          sequence: 2,
          actorId: context.tenant.userId,
          tenantId: context.tenant.tenantId,
          source: 'IntentEngine',
          correlationId: context.trace.correlationId,
          causationId: context.id,
          payload: { resolvedIntent: context.resolvedIntent }
        });
      
        context = await TelemetryEngine.withSpan('intent.resolving', context.trace, { tenantId }, async (spanTrace) => {
          // 2. Deterministic Capability + Workflow Search (single pass)
          const searchResult = CapabilitySearch.search(context.resolvedIntent!.action);
          if (!searchResult) throw new Error(`No capability found for action: "${context.resolvedIntent!.action}"`);

          const { pkg, workflow, matchScore } = searchResult;

          // 3. Fine-grained Workflow Selection within the capability
          const selectedWorkflow = WorkflowSelector.select(pkg, context.resolvedIntent!.action) ?? workflow;

          // 4. Compute weighted confidence with hard gates
          const entityScore = Object.keys(context.resolvedIntent!.entities).length > 0 ? 0.9 : 0.5;
          const finalConfidence = PlannerConfidence.compute(
            context.resolvedIntent!.confidence,  // intent  35%
            matchScore,                           // capability 30%
            selectedWorkflow ? 1.0 : 0.5,        // workflow 25%
            entityScore                           // entities 10%
          );

          if (finalConfidence < 0.75) {
            throw new Error(`Planner confidence too low (${finalConfidence.toFixed(2)}) for: "${context.resolvedIntent!.action}". Needs clarification.`);
          }

          // 5. Dependency Resolver — raises WaitingForClarification if fields missing
          const resolver = new DependencyResolver();
          const depsMet = await resolver.resolveDependencies(context, selectedWorkflow, context.resolvedIntent!.entities);
          if (!depsMet) {
            return context; // state is now WaitingForClarification
          }

          // 6. Planner Cache: cache at workflow template level, hydrate entities only
          const cacheKey = GlobalPlannerCache.generateKey(selectedWorkflow.id);
          let planTemplate = GlobalPlannerCache.get(cacheKey)?.template;
          if (!planTemplate) {
            planTemplate = selectedWorkflow.plan;
            GlobalPlannerCache.set(cacheKey, { capabilityId: pkg.manifest.id, workflow: selectedWorkflow, template: planTemplate });
          }

          const hydratedPlan = ExecutionPlanBuilder.build(context, planTemplate, context.resolvedIntent!.entities);
          context.executionPlan = hydratedPlan;

          // 7. Planner Policy — tenant/plan/role gate before execution
          const policyPassed = PlannerPolicy.evaluate(context, hydratedPlan, pkg.manifest.id);
          if (!policyPassed) {
            context.state = 'Failed';
            throw new Error(`Planner Policy denied execution of "${selectedWorkflow.id}" for tenant "${tenantId}"`);
          }

          context.state = 'Authorized';
          context.trace = spanTrace;
          return context;
        });
        
        if (context.state === 'WaitingForClarification' || context.state === 'Failed') {
          return { success: false, intentId: context.id, action: context.resolvedIntent?.action, state: context.state };
        }
      
        context = await TelemetryEngine.withSpan('workflow.execution', context.trace, { tenantId }, async (spanTrace) => {
          context.trace = spanTrace;
          await TenantScheduler.submit(context);
          return context;
        });

      // ─── THE OBSERVATION & OUTCOME PIPELINE ───
      context = await ObservationEngine.observe(context);
      context = await OutcomeTracker.track(context);

      Logger.info(`Pipeline Complete. Final State: ${context.state}`, {
        source: 'IntentService',
        trace: context.trace,
        userId,
        tenantId
      });

      return { 
        success: context.state === 'Learned' || context.state === 'Completed', 
        intentId: context.id, 
        action: context.resolvedIntent?.action 
      };

    } catch (err: any) {
      Logger.error(`Pipeline Failure: ${err.message}`, {
        source: 'IntentService',
        trace: context.trace,
        userId,
        tenantId,
        error: err
      });
      
      TelemetryEngine.increment('intent_resolution_failed', 1, context.trace, {
        tenantId,
        source: 'IntentService'
      });
      
      // Attempt to gracefully track failure outcome
      context.state = 'Failed';
      context.observations.push({
        timestamp: new Date().toISOString(),
        type: 'bottleneck',
        component: 'IntentPipeline',
        details: err.message
      });
      await OutcomeTracker.track(context);

      throw err;
    }
    });
  }
}

export const IntentService = new SystemIntentService();
