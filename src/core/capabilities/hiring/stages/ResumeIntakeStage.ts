import { BaseHiringStage } from './BaseHiringStage';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';

export class ResumeIntakeStage extends BaseHiringStage {
  constructor() {
    super('resume_intake', 'Resume Intake', []);
  }

  async validate(context: IWorkflowContext): Promise<boolean> {
    return true; // Always valid to start
  }

  async execute(context: IWorkflowContext): Promise<void> {
    if (!context.state.resumeFileUrl && !context.state.resumeText) {
      this.status = 'PAUSED';
      // Signal to Conversation Engine that we need input
      context.state.pendingQuestion = "Please upload the candidate's resume to begin.";
      return;
    }
    
    // Once we have a resume, we are done intake
  }
}
