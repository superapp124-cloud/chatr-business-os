import { Intent } from '../intent/types';
import { ResolvedContext } from '../capabilities/types';
import { resolverRegistry } from './ResolverRegistry';

export class ContextResolutionPipelineImpl {
  private static instance: ContextResolutionPipelineImpl;

  private constructor() {}

  public static getInstance(): ContextResolutionPipelineImpl {
    if (!ContextResolutionPipelineImpl.instance) {
      ContextResolutionPipelineImpl.instance = new ContextResolutionPipelineImpl();
    }
    return ContextResolutionPipelineImpl.instance;
  }

  /**
   * Hydrates the raw Intent with Enterprise Context.
   */
  public async hydrate(intent: Intent): Promise<{ hydratedIntent: Intent, context: ResolvedContext, trace: any[] }> {
    console.log(`[ContextPipeline] Hydrating intent: ${intent.type}`);
    
    let context: Partial<ResolvedContext> = {};
    const trace: any[] = [];
    
    // 1. Log Start
    trace.push({
      step: 'Intent Received',
      data: { type: intent.type, confidence: intent.confidence }
    });

    // 2. Execute Pluggable Resolvers in Order
    const resolvers = resolverRegistry.getResolvers();
    
    for (const resolver of resolvers) {
      const startTime = performance.now();
      
      try {
        const resolvedFragment = await resolver.resolve(intent, context);
        
        // Merge the fragment into the main context
        context = { ...context, ...resolvedFragment };
        
        trace.push({
          step: `Resolver: ${resolver.name}`,
          status: 'success',
          latencyMs: Math.round(performance.now() - startTime),
          data: resolvedFragment
        });
      } catch (err: any) {
        console.error(`[ContextPipeline] Resolver ${resolver.name} failed:`, err);
        trace.push({
          step: `Resolver: ${resolver.name}`,
          status: 'error',
          latencyMs: Math.round(performance.now() - startTime),
          error: err.message
        });
      }
    }

    // 3. Complete
    trace.push({
      step: 'Hydration Complete',
      contextKeys: Object.keys(context)
    });

    console.log(`[ContextPipeline] Hydration trace complete: ${trace.length} steps.`);
    
    // Attach the hydrated context to the intent for the CommitmentPlanner to consume
    const hydratedIntent = { ...intent, enterpriseContext: context as ResolvedContext };

    return { hydratedIntent, context: context as ResolvedContext, trace };
  }
}

export const contextResolutionPipeline = ContextResolutionPipelineImpl.getInstance();
