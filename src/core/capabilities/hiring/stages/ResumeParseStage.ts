import { BaseHiringStage } from './BaseHiringStage';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { ModelRouter } from '@/core/ai/runtime/ModelRouter';

export class ResumeParseStage extends BaseHiringStage {
  constructor() {
    super('resume_parse', 'Resume Parse', []);
  }

  async validate(context: IWorkflowContext): Promise<boolean> {
    return !!context.state.resumeFileUrl || !!context.state.resumeText;
  }

  async execute(context: IWorkflowContext): Promise<void> {
    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    
    // Route to the best extraction model
    const { provider } = await ModelRouter.route('extractStructuredData', aiProviders);
    
    const rawText = context.state.resumeText || `[Content of ${context.state.resumeFileUrl}]`;
    const response = await provider.extractStructuredData<any>(rawText, 'Resume');

    const artifactId = crypto.randomUUID();
    context.artifacts.resume = {
      ...response.result,
      id: artifactId,
      version: 1,
      createdAt: Date.now(),
      createdBy: provider.id,
      type: 'ResumeArtifact',
      relatedArtifacts: [],
      confidence: response.confidence,
      reasoning_summary: response.reasoning,
      rawText
    };
  }
}
