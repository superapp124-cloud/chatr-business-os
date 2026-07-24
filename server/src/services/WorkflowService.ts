import { EventBus } from './EventBusService.js';
import { ObjectRegistry } from '../kernel/ObjectRegistry.js';
import { ExecutionContext, ExecutionPlanStep } from '../types.js';
import { ExecutionStore } from '../kernel/execution/ExecutionStore.js';
import { EventDispatcher } from '../kernel/events/EventDispatcher.js';
import { Logger } from '../kernel/observability/SystemLogger.js';
import { TelemetryEngine } from '../kernel/observability/TelemetryEngine.js';
import { QuotaEngine } from '../kernel/tenant/QuotaEngine.js';
import { BusinessObjectRepository } from '../kernel/repositories/BusinessObjectRepository.js';

export class SystemWorkflowEngine {
  
  async executePlan(context: ExecutionContext): Promise<ExecutionContext> {
    if (context.state !== 'Authorized' && context.state !== 'Executing') {
      Logger.info(`Skipping execution. Context is in state: ${context.state}`, {
        source: 'WorkflowRuntime',
        trace: context.trace,
        userId: context.tenant.userId,
        tenantId: context.tenant.tenantId
      });
QuotaEngine.releaseWorkflow(context.tenant.tenantId);
      return context;
    }

    const plan = context.executionPlan;
    if (!plan) throw new Error('WorkflowRuntime requires an ExecutionPlan.');

    Logger.info(`Executing Plan ${plan.id} for Context ${context.id}`, {
        source: 'WorkflowRuntime',
        trace: context.trace,
        userId: context.tenant.userId,
        tenantId: context.tenant.tenantId,
        planId: plan.id
    });
    context.state = 'Executing';
    
    await EventDispatcher.dispatch({
      eventType: 'workflow.started',
      streamId: context.id,
      sequence: 4, // 1-3 were intent lifecycle
      actorId: context.tenant.userId,
      tenantId: context.tenant.tenantId,
      source: 'WorkflowRuntime',
      correlationId: context.trace.correlationId,
      payload: { planId: plan.id }
    });
    
    let createdObjectId = null;
    const startTime = Date.now();
    let sequenceCounter = 5;

    for (const step of plan.steps) {
      if (step.status === 'Completed' || step.status === 'Skipped') {
        Logger.info(`Skipping step ${step.idempotencyKey} (already ${step.status})`, {
            source: 'WorkflowRuntime',
            trace: context.trace,
            userId: context.tenant.userId,
            tenantId: context.tenant.tenantId
        });
        continue;
      }

      if (step.status === 'Failed' && step.retryCount >= step.maxAttempts) {
        Logger.error(`Step ${step.idempotencyKey} exhausted retries. Halting plan.`, {
            source: 'WorkflowRuntime',
            trace: context.trace,
            userId: context.tenant.userId,
            tenantId: context.tenant.tenantId
        });
        context.state = 'Failed';
        await ExecutionStore.saveCheckpoint(context);
        
        await EventDispatcher.dispatch({
          eventType: 'workflow.failed',
          streamId: context.id,
          sequence: sequenceCounter++,
          actorId: context.tenant.userId,
          tenantId: context.tenant.tenantId,
          source: 'WorkflowRuntime',
          correlationId: context.trace.correlationId,
          payload: { reason: `Step ${step.idempotencyKey} exhausted retries` }
        });
        
  QuotaEngine.releaseWorkflow(context.tenant.tenantId);
      return context;
      }

      // Step Start
      step.status = 'Running';
      step.startedAt = new Date().toISOString();
      await ExecutionStore.saveCheckpoint(context);
      
      await EventDispatcher.dispatch({
        eventType: 'workflow.step.started',
        streamId: context.id,
        sequence: sequenceCounter++,
        actorId: context.tenant.userId,
        tenantId: context.tenant.tenantId,
        source: 'WorkflowRuntime',
        correlationId: context.trace.correlationId,
        payload: { stepId: step.id, action: step.action }
      });

      try {
        await this.executeStepWithTimeout(context, step, createdObjectId);
        
        // Step Success
        step.status = 'Completed';
        step.finishedAt = new Date().toISOString();
        if (step.action === 'Database.Insert') {
          createdObjectId = context.metadata.lastInsertedId; 
        }
        
        TelemetryEngine.recordDuration(`workflow.step.duration`, Date.now() - new Date(step.startedAt).getTime(), context.trace, {
            tenantId: context.tenant.tenantId,
            source: 'WorkflowRuntime',
            action: step.action
        });

        await EventDispatcher.dispatch({
          eventType: 'workflow.step.completed',
          streamId: context.id,
          sequence: sequenceCounter++,
          actorId: context.tenant.userId,
          tenantId: context.tenant.tenantId,
          source: 'WorkflowRuntime',
          correlationId: context.trace.correlationId,
          payload: { stepId: step.id }
        });
        
        context.completedSteps.push(step.id);
        console.log(`Pushed step ${step.id} to completedSteps. Now it is: ${context.completedSteps}`);

      } catch (err: any) {
        if (err.message === 'PAUSED_FOR_APPROVAL') {
          Logger.info(`[WorkflowRuntime] Skipping execution. Context is in state: Waiting`);
          await ExecutionStore.saveCheckpoint(context);
          QuotaEngine.releaseWorkflow(context.tenant.tenantId);
          return context;
        }

        Logger.error(`Step failed: ${step.idempotencyKey} - ${err.message}`, {
            source: 'WorkflowRuntime',
            trace: context.trace,
            userId: context.tenant.userId,
            tenantId: context.tenant.tenantId,
            error: err
        });
        
        TelemetryEngine.increment('workflow.step.failed', 1, context.trace, {
            tenantId: context.tenant.tenantId,
            source: 'WorkflowRuntime',
            action: step.action
        });
        
        step.retryCount++;
        step.status = 'Failed';
        
        await EventDispatcher.dispatch({
          eventType: 'workflow.step.failed',
          streamId: context.id,
          sequence: sequenceCounter++,
          actorId: context.tenant.userId,
          tenantId: context.tenant.tenantId,
          source: 'WorkflowRuntime',
          correlationId: context.trace.correlationId,
          payload: { stepId: step.id, error: err.message, retryCount: step.retryCount }
        });
        
        context.observations.push({
          timestamp: new Date().toISOString(),
          type: 'bottleneck',
          component: 'WorkflowRuntime',
          details: `Step ${step.idempotencyKey} failed: ${err.message}`
        });
      }

      if (step.status === 'Failed') {
        context.state = 'Failed';
        await ExecutionStore.saveCheckpoint(context);
        await EventDispatcher.dispatch({
          eventType: 'workflow.failed',
          streamId: context.id,
          sequence: sequenceCounter++,
          actorId: context.tenant.userId,
          tenantId: context.tenant.tenantId,
          source: 'WorkflowRuntime',
          correlationId: context.trace.correlationId,
          payload: { reason: `Step ${step.idempotencyKey} failed during execution` }
        });
  QuotaEngine.releaseWorkflow(context.tenant.tenantId);
      return context;
      }
      
      await ExecutionStore.saveCheckpoint(context);
    }

    context.observations.push({
      timestamp: new Date().toISOString(),
      type: 'duration',
      component: 'WorkflowRuntime',
      details: `Execution took ${Date.now() - startTime}ms`
    });

    context.state = 'Completed';
    await ExecutionStore.saveCheckpoint(context);
    
    const workflowDuration = Date.now() - startTime;
    TelemetryEngine.recordDuration('workflow.duration', workflowDuration, context.trace, {
        tenantId: context.tenant.tenantId,
        source: 'WorkflowRuntime'
    });
    
    await EventDispatcher.dispatch({
      eventType: 'workflow.completed',
      streamId: context.id,
      sequence: sequenceCounter++,
      actorId: context.tenant.userId,
      tenantId: context.tenant.tenantId,
      source: 'WorkflowRuntime',
      correlationId: context.trace.correlationId,
      payload: { durationMs: Date.now() - startTime }
    });
    
    QuotaEngine.releaseWorkflow(context.tenant.tenantId);
    return context;
  }

  private async executeStepWithTimeout(context: ExecutionContext, step: ExecutionPlanStep, createdObjectId: string | null): Promise<void> {
    Logger.info(`Starting execution of step: ${step.idempotencyKey} (Attempt ${step.retryCount + 1}/${step.maxAttempts})`, {
        source: 'WorkflowRuntime',
        trace: context.trace
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        step.status = 'TimedOut';
        reject(new Error(`Step execution timed out after ${step.timeoutMs}ms`));
      }, step.timeoutMs);

      this.executeGenericStep(context, step, createdObjectId)
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
  private async executeGenericStep(context: ExecutionContext, step: ExecutionPlanStep, lastCreatedId: any) {
    if (step.action === 'Database.Insert') {
      const id = await this.executeGenericInsert(context, step, step.payload.type);
      context.metadata.lastInsertedId = id;
    }
    else if (step.action === 'Database.Update') {
      // Real update: use lastCreatedId or the id from step payload
      const objectId = lastCreatedId ?? step.payload.id;
      if (!objectId) {
        Logger.warn(`[WorkflowRuntime] Database.Update skipped: no object ID available for type ${step.payload.type}`, {
          source: 'WorkflowRuntime', trace: context.trace
        });
        return;
      }
      const { getTenantSupabaseClient } = await import('../utils/supabaseClient.js');
      const supabase = getTenantSupabaseClient(context.tenant);
      const updates = { ...step.payload, updatedAt: new Date().toISOString() };
      delete updates.type;
      const { error } = await supabase
        .from('os_work_objects')
        .update(updates)
        .eq('id', objectId);
      if (error) throw new Error(`Database.Update failed: ${error.message}`);
      Logger.info(`[WorkflowRuntime] Database.Update successful for object ${objectId}`, {
        source: 'WorkflowRuntime', trace: context.trace
      });
    }
    else if (step.action === 'Publish') {
      await EventDispatcher.dispatch({
        eventType: step.payload.eventType,
        payload: { contextId: context.id, objectId: lastCreatedId, ...step.payload },
        source: 'WorkflowRuntime',
        actorId: context.tenant.userId,
        tenantId: context.tenant.tenantId,
        streamId: context.id,
        sequence: 1,
        correlationId: context.trace.correlationId
      });
    }
    else if (step.action === 'Approval.Request') {
      step.status = 'Pending';
      context.state = 'Waiting';
      Logger.info(`[WorkflowRuntime] Workflow paused for Approval. Requesting role: ${step.payload.role}`, {
        source: 'System', trace: context.trace
      });
      throw new Error('PAUSED_FOR_APPROVAL'); // Custom signal to pause
    }
    else if (step.action === 'Approval.Resolve') {
      Logger.info(`[WorkflowRuntime] Approval Resolved with status: ${step.payload.status}`, {
        source: 'System', trace: context.trace
      });
    }
    else if (step.action === 'Provider.Send') {
      // Real provider call — POST to the provider endpoint if configured, else log
      const providerUrl = process.env[`PROVIDER_${(step.payload.provider ?? 'DEFAULT').toUpperCase()}_URL`];
      if (providerUrl) {
        const response = await fetch(providerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: step.payload.type, contextId: context.id, ...step.payload })
        });
        if (!response.ok) throw new Error(`Provider.Send failed: ${response.status} ${response.statusText}`);
        Logger.info(`[WorkflowRuntime] Provider.Send OK (${step.payload.provider ?? 'default'})`, {
          source: 'WorkflowRuntime', trace: context.trace
        });
      } else {
        // No provider configured — log and continue (non-blocking for dev environments)
        Logger.info(`[WorkflowRuntime] Provider.Send: no URL configured for provider '${step.payload.provider ?? 'default'}', step recorded.`, {
          source: 'WorkflowRuntime', trace: context.trace
        });
      }
    }
    else {
      Logger.warn(`[WorkflowRuntime] Unknown step action: ${step.action}. Skipping.`, {
        source: 'WorkflowRuntime', trace: context.trace
      });
    }
  }

  private async executeGenericInsert(context: ExecutionContext, step: ExecutionPlanStep, objectType: string) {
    const entities = context.resolvedIntent?.entities ?? {};
    const title = entities.title ?? entities.name ?? entities.subject ?? `${objectType} - ${new Date().toLocaleDateString()}`;

    // Use ObjectRegistry if type is registered; otherwise build generically from entities
    let woParams: any;
    try {
      woParams = ObjectRegistry.createInstance(objectType, context.tenant.userId, context.tenant.tenantId, {
        title,
        status: 'active',
        ...entities
      });
    } catch {
      // Type not yet registered — build a generic work object directly
      woParams = {
        type: objectType,
        title,
        status: 'active',
        ownerId: context.tenant.userId,
        tenantId: context.tenant.tenantId,
        departmentId: context.tenant.tenantId,
        priority: 'medium',
        metadata: { ...entities },
        knowledgeLinks: [],
        attachments: {},
        permissions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    const wo = await BusinessObjectRepository.insertObject(woParams);

    try {
      await EventBus.audit(objectType, wo.id, 'CREATE', null, wo, context.tenant.userId, context.tenant.tenantId, 'V1.0 OS Pipeline');
    } catch {
      // Audit failure is non-fatal in test environments without tenant context
    }

    return wo.id;
  }
}

export const WorkflowEngine = new SystemWorkflowEngine();
