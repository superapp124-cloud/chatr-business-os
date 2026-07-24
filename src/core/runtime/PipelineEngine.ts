import { eventBus } from './EventBus';
import { taskRuntime, ITask, TaskPriority, CancellationToken } from './TaskRuntime';
import { workflowStateStore } from './WorkflowStateStore';

export type StageStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';

export interface IWorkflowContext {
  id: string;
  type: string; // e.g. "hiring", "sales"
  state: Record<string, any>;
  artifacts: Record<string, any>; // Versioned artifacts
  policies: Record<string, any>;
}

export interface IWorkflowStage {
  id: string;
  name: string;
  dependencies: string[]; // IDs of stages that must complete before this one
  status: StageStatus;
  
  execute(context: IWorkflowContext, token?: CancellationToken): Promise<void>;
  validate(context: IWorkflowContext): Promise<boolean>;
  resume(context: IWorkflowContext): Promise<void>;
  rollback(context: IWorkflowContext): Promise<void>;
  retry(context: IWorkflowContext): Promise<void>;
  timeout(): number; // in milliseconds
  priority?(): TaskPriority;
  maxRetries?(): number;
}

export class PipelineEngine {
  private stages: Map<string, IWorkflowStage> = new Map();
  private context: IWorkflowContext;
  private unsubscribeFn?: () => void;
  private isFinished = false;

  constructor(context: IWorkflowContext, stages: IWorkflowStage[]) {
    this.context = context;
    stages.forEach(s => this.stages.set(s.id, s));
  }

  public getContext(): IWorkflowContext {
    return this.context;
  }

  public getStages(): IWorkflowStage[] {
    return Array.from(this.stages.values());
  }

  public getStage(id: string): IWorkflowStage | undefined {
    return this.stages.get(id);
  }

  /**
   * Starts the workflow by submitting initially ready stages to the TaskRuntime.
   * Execution is completely decoupled from this class now.
   */
  public start(): void {
    if (this.isFinished) return;
    
    workflowStateStore.saveState(this.context, 'START', 'RUNNING').catch(console.error);
    eventBus.publish('PIPELINE_STARTED', { workflowId: this.context.id, type: this.context.type });
    this.setupEventListeners();
    this.submitReadyStages();
  }

  private setupEventListeners() {
    const handleCompletion = (e: any) => {
      const p = e.payload || e;
      if (p.workflowId !== this.context.id) return;
      if (this.isFinished) return;

      const stage = this.stages.get(p.taskId);
      if (!stage) return;

      if (p.status === 'COMPLETED') {
        stage.status = 'COMPLETED';
        workflowStateStore.saveCheckpoint(this.context.id, stage.id, this.context).catch(console.error);
        this.submitReadyStages();
      } else if (p.status === 'FAILED') {
        stage.status = 'FAILED';
        // By default, if a stage fails and retries are exhausted, the pipeline halts.
        // Compensation triggers would hook in here.
        this.checkIfFinished();
      } else if (p.status === 'CANCELLED') {
        stage.status = 'CANCELLED';
        this.checkIfFinished();
      }
      workflowStateStore.saveState(this.context, stage.id, stage.status).catch(console.error);
    };

    eventBus.subscribe('TASK_COMPLETED', handleCompletion);
    eventBus.subscribe('TASK_FAILED', handleCompletion);
    eventBus.subscribe('TASK_CANCELLED', handleCompletion);

    // Store a generic cleanup
    this.unsubscribeFn = () => {
      eventBus.unsubscribe('TASK_COMPLETED', handleCompletion);
      eventBus.unsubscribe('TASK_FAILED', handleCompletion);
      eventBus.unsubscribe('TASK_CANCELLED', handleCompletion);
    };
  }

  private submitReadyStages(): void {
    const readyStages = this.getReadyStages();
    
    if (readyStages.length === 0) {
      this.checkIfFinished();
      return;
    }

    readyStages.forEach(stage => {
      stage.status = 'QUEUED';
      
      const task: ITask = {
        id: stage.id,
        workflowId: this.context.id,
        name: stage.name,
        metadata: {
          priority: stage.priority ? stage.priority() : TaskPriority.NORMAL,
          timeoutMs: stage.timeout(),
          maxRetries: stage.maxRetries ? stage.maxRetries() : 0,
          domain: this.context.type
        },
        status: 'PENDING',
        execute: async (token) => {
          stage.status = 'RUNNING';
          const isValid = await stage.validate(this.context);
          if (!isValid) throw new Error('Stage validation failed');
          return stage.execute(this.context, token);
        }
      };

      taskRuntime.submit(task);
    });
  }

  private getReadyStages(): IWorkflowStage[] {
    return this.getStages().filter(s => 
      s.status === 'PENDING' && 
      s.dependencies.every(depId => this.stages.get(depId)?.status === 'COMPLETED')
    );
  }

  private checkIfFinished(): void {
    if (this.isFinished) return;

    const stages = this.getStages();
    const hasFailed = stages.some(s => s.status === 'FAILED' || s.status === 'CANCELLED');
    const allDone = stages.every(s => s.status === 'COMPLETED');

    if (allDone) {
      this.isFinished = true;
      if (this.unsubscribeFn) this.unsubscribeFn();
      eventBus.publish('PIPELINE_COMPLETED', { workflowId: this.context.id });
    } else if (hasFailed) {
      // If there are failed stages and no more ready stages, we're stuck (failed)
      const hasReadyOrRunning = stages.some(s => s.status === 'PENDING' || s.status === 'QUEUED' || s.status === 'RUNNING');
      if (!hasReadyOrRunning) {
        this.isFinished = true;
        if (this.unsubscribeFn) this.unsubscribeFn();
        eventBus.publish('PIPELINE_FAILED', { workflowId: this.context.id });
      }
    }
  }
}
