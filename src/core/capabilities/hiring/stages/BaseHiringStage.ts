import { IWorkflowStage, IWorkflowContext, StageStatus } from '@/core/runtime/PipelineEngine';

export abstract class BaseHiringStage implements IWorkflowStage {
  id: string;
  name: string;
  dependencies: string[];
  status: StageStatus = 'PENDING';

  constructor(id: string, name: string, dependencies: string[] = []) {
    this.id = id;
    this.name = name;
    this.dependencies = dependencies;
  }

  abstract execute(context: IWorkflowContext): Promise<void>;
  
  async validate(context: IWorkflowContext): Promise<boolean> {
    return true; // Default to true, subclasses override
  }

  async resume(context: IWorkflowContext): Promise<void> {
    // Default implementation
    this.status = 'RUNNING';
    return this.execute(context);
  }

  async rollback(context: IWorkflowContext): Promise<void> {
    this.status = 'PENDING';
    // Subclasses implement cleanup
  }

  async retry(context: IWorkflowContext): Promise<void> {
    if (this.status === 'FAILED') {
      this.status = 'PENDING';
      return this.resume(context);
    }
  }

  timeout(): number {
    return 15000; // 15 seconds default timeout
  }
}
