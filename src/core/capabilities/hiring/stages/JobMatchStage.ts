import { BaseHiringStage } from './BaseHiringStage';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { ModelRouter } from '@/core/ai/runtime/ModelRouter';
import { ResumeArtifact } from '../artifacts';

export class JobMatchStage extends BaseHiringStage {
  constructor() {
    super('job_match', 'Job Matching', ['resume_parse']);
  }

  async validate(context: IWorkflowContext): Promise<boolean> {
    return !!context.state.jobDescription && !!context.artifacts.resume;
  }

  async execute(context: IWorkflowContext): Promise<void> {
    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    
    // Route to the best reasoning model
    const { provider } = await ModelRouter.route('reason', aiProviders);
    
    const resumeArtifact = context.artifacts.resume as ResumeArtifact;
    
    const prompt = `Match Candidate ${resumeArtifact.candidateName} with Job Description.`;
    // We would use a structured schema here in reality, but we simulate it.
    const response = await provider.extractStructuredData<any>(prompt, 'JobMatch');

    const artifactId = crypto.randomUUID();
    context.artifacts.candidateMatch = {
      ...response.result,
      id: artifactId,
      version: 1,
      createdAt: Date.now(),
      createdBy: provider.id,
      type: 'CandidateMatchArtifact',
      relatedArtifacts: [resumeArtifact.id],
      confidence: response.confidence,
      reasoning_summary: response.reasoning,
      missing_information: response.missing_information
    };
  }
}
