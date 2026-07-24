import { ProjectionService, CurrentStateProjection, GraphProjection } from '../projections/ProjectionService';

/**
 * Simplified interfaces for the Kernel Services required by the Query Engine
 */
export interface ISemanticService {
  resolveAlias(term: string, context: string): Promise<string>;
}

export interface IPolicyEngine {
  canRead(actorId: string, aggregateType: string, aggregateId: string): Promise<boolean>;
}

export interface ITimeService {
  // Returns state at a specific point in time (requires replaying events up to T)
  getStateAt(aggregateType: string, aggregateId: string, timestamp: Date): Promise<any>;
}

export interface QueryRequest {
  actorId: string;
  aggregateType: string;
  aggregateId: string;
  timestamp?: Date;        // If provided, queries historical state
  semanticContext?: string; // e.g., 'Recruitment' or 'IT'
}

export interface ListQueryRequest {
  actorId: string;
  aggregateType: string;
}

/**
 * The Query Engine
 * 
 * The universal read layer. All clients (Business OS, Studio, AI, Mobile) 
 * query state exclusively through this engine. It orchestrates semantics, 
 * permissions, projections, and time.
 */
export class QueryEngine {
  constructor(
    private projectionService: ProjectionService,
    private semanticService?: ISemanticService,
    private policyEngine?: IPolicyEngine,
    private timeService?: ITimeService
  ) {}

  /**
   * Universal fetch for a single aggregate.
   */
  async get(request: QueryRequest): Promise<any> {
    
    // 1. Semantic Resolution
    let resolvedType = request.aggregateType;
    if (this.semanticService && request.semanticContext) {
      resolvedType = await this.semanticService.resolveAlias(request.aggregateType, request.semanticContext);
    }

    // 2. Permission Check
    if (this.policyEngine) {
      const allowed = await this.policyEngine.canRead(request.actorId, resolvedType, request.aggregateId);
      if (!allowed) {
        throw new Error(`Access Denied: Actor ${request.actorId} cannot read ${resolvedType} ${request.aggregateId}`);
      }
    }

    // 3. Time Resolution
    if (request.timestamp && this.timeService) {
      // Historical query (Past State)
      return await this.timeService.getStateAt(resolvedType, request.aggregateId, request.timestamp);
    }

    // 4. Projection Query (Current State)
    // Find the CurrentStateProjection in the registered projections
    // (Assuming direct access for brevity, usually exposed via an accessor)
    const currentProjection = (this.projectionService as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    
    if (!currentProjection) {
      throw new Error('CurrentStateProjection is not available.');
    }

    const state = currentProjection.getState(request.aggregateId);
    
    if (!state) {
      return null;
    }

    // Include resolved type in the result to maintain explicit typing
    return {
      __type: resolvedType,
      ...state
    };
  }

  /**
   * Universal fetch for all aggregates of a given type.
   */
  async query(request: ListQueryRequest): Promise<any[]> {
    const currentProjection = (this.projectionService as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    
    if (!currentProjection) {
      throw new Error('CurrentStateProjection is not available.');
    }

    const allStates = (currentProjection as any).stateMap;
    const results = [];

    for (const [id, state] of allStates.entries()) {
      if ((state as any).type === request.aggregateType || state.__type === request.aggregateType || (state as any).stage !== undefined) {
        // Fallback checks for Gate B MVP since `type` isn't always pushed into payload by ObjectRuntime
        results.push({
          __type: request.aggregateType,
          ...((state as any).payload || state),
          id: id
        });
      }
    }

    return results;
  }

  /**
   * Graph Resolution (Find all related objects)
   */
  async getRelated(request: QueryRequest, predicate?: string): Promise<any[]> {
    // 1. Semantic & Permission Checks (similar to get)
    if (this.policyEngine) {
      const allowed = await this.policyEngine.canRead(request.actorId, request.aggregateType, request.aggregateId);
      if (!allowed) throw new Error('Access Denied');
    }

    const graphProjection = (this.projectionService as any).projections.find((p: any) => p.name === 'Graph') as GraphProjection;
    if (!graphProjection) throw new Error('GraphProjection is not available.');

    const edges = (graphProjection as any).edges; // Internal array for this example
    const relatedEdges = edges.filter((e: any) => 
      e.source === request.aggregateId && 
      (!predicate || e.predicate === predicate)
    );

    // Resolve the actual target objects
    const results = [];
    for (const edge of relatedEdges) {
      // (Simplified: assuming we know the target type or it's embedded in the edge target ID)
      // We would call this.get() for each target to ensure per-object permissions are respected
      const targetState = await this.get({
        actorId: request.actorId,
        aggregateType: 'Unknown', // In reality, we'd look up the target type from the URN
        aggregateId: edge.target
      }).catch(() => null); // Ignore if permission denied

      if (targetState) results.push({ edge, targetState });
    }

    return results;
  }
}
