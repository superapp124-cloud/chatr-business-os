import { BaseHiringStage } from './BaseHiringStage';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';

export class OfferStage extends BaseHiringStage {
  constructor() {
    super('offer', 'Offer Generation', ['interview_plan']); // In reality it depends on interview_feedback
  }

  async validate(context: IWorkflowContext): Promise<boolean> {
    return !!context.artifacts.interviewPlan && !!context.state.feedbackReceived;
  }

  async execute(context: IWorkflowContext): Promise<void> {
    // Save as versioned artifact
    const artifactId = crypto.randomUUID();
    context.artifacts.offer = {
      id: artifactId,
      version: 1,
      createdAt: Date.now(),
      createdBy: 'OfferStage',
      type: 'OfferArtifact',
      relatedArtifacts: [context.artifacts.interviewPlan.id],
      candidateName: context.artifacts.resume.candidateName,
      role: 'Senior Backend Engineer',
      salaryOffered: context.state.negotiatedSalary || '₹28 LPA',
      joiningDate: '2026-08-15',
      status: 'DRAFT'
    };
  }
}
