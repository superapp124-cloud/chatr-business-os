import { PipelineEngine, IWorkflowContext } from '@/core/runtime/PipelineEngine';
import { ResumeIntakeStage } from './stages/ResumeIntakeStage';
import { ResumeParseStage } from './stages/ResumeParseStage';
import { JobMatchStage } from './stages/JobMatchStage';
import { InterviewPlanStage } from './stages/InterviewPlanStage';
import { OfferStage } from './stages/OfferStage';
import { CapabilityContract } from '../types';

export class HiringPlanner implements CapabilityContract {
  private engine: PipelineEngine | null = null;
  private context: IWorkflowContext | null = null;

  async initialize(): Promise<void> {
    // Initialization logic if any
  }

  async plan(intent: any): Promise<any> {
    // Extract early parameters from intent
    const resumeText = intent.parameters?.resumeText;
    const jobDescription = intent.parameters?.jobDescription || "Default Job Description";

    this.context = {
      id: crypto.randomUUID(),
      type: 'hiring',
      state: {
        resumeText,
        jobDescription
      },
      artifacts: {},
      policies: {}
    };

    const stages = [
      new ResumeIntakeStage(),
      new ResumeParseStage(),
      new JobMatchStage(),
      new InterviewPlanStage(),
      new OfferStage()
    ];

    this.engine = new PipelineEngine(this.context, stages);
    return this.engine;
  }

  async execute(context: any): Promise<void> {
    if (!this.engine) throw new Error("Planner not initialized. Call plan() first.");
    await this.engine.executeAll();
  }

  async pause(context: any): Promise<void> {
    // Pipeline engine handles pausing naturally when stages fail or wait
  }

  async resume(context: any): Promise<void> {
    if (this.engine) {
      await this.engine.executeAll();
    }
  }

  async cancel(context: any): Promise<void> {
    if (this.engine) {
      this.engine.getStages().forEach(s => {
        if (s.status === 'PENDING' || s.status === 'RUNNING') {
          s.status = 'PAUSED';
        }
      });
    }
  }

  async rollback(context: any): Promise<void> {
    if (this.engine) {
      for (const stage of this.engine.getStages()) {
        await stage.rollback(this.context!);
      }
    }
  }

  exportArtifacts(): any[] {
    if (!this.context) return [];
    return Object.values(this.context.artifacts);
  }
}
