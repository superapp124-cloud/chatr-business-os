import { BaseHiringStage } from './BaseHiringStage';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { ModelRouter } from '@/core/ai/runtime/ModelRouter';
import { CandidateMatchArtifact } from '../artifacts';

export class InterviewPlanStage extends BaseHiringStage {
  constructor() {
    super('interview_plan', 'Interview Planning', ['job_match']);
  }

  async validate(context: IWorkflowContext): Promise<boolean> {
    const match = context.artifacts.candidateMatch as CandidateMatchArtifact;
    return !!match && match.recommendation === 'PROCEED_TO_INTERVIEW';
  }

  async execute(context: IWorkflowContext): Promise<void> {
    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    
    // Route to the best reasoning model
    const { provider } = await ModelRouter.route('reason', aiProviders);

    const prompt = `Generate Interview Plan for candidate based on gaps.`;
    const response = await provider.extractStructuredData<any>(prompt, 'InterviewPlan');

    const artifactId = crypto.randomUUID();
    context.artifacts.interviewPlan = {
      ...response.result,
      id: artifactId,
      version: 1,
      createdAt: Date.now(),
      createdBy: provider.id,
      type: 'InterviewPlanArtifact',
      relatedArtifacts: [context.artifacts.candidateMatch.id],
      confidence: response.confidence,
      reasoning_summary: response.reasoning
    };
  }
}
