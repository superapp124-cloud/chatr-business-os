/**
 * CHATR Kernel Implementation v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of KernelABI.
 *
 * ARCHITECTURE:
 *   - Every subsystem (Scheduler, Broker, VerificationService) calls ONLY
 *     through the KernelABI interface. They never import each other.
 *   - Storage is in-memory Maps. Each Map is an independent subsystem
 *     that can be replaced with a persistent adapter without touching
 *     any call site.
 *   - The Intelligence Bus uses the existing eventBus facade so that
 *     existing React hooks (useWorkflowSession, etc.) keep working
 *     during the migration.
 *
 * PLUGIN POINTS (replaceable without changing this file):
 *   - PlannerPlugin  — handles intent decomposition
 *   - PolicyEngine   — evaluates policies before execution
 *   - TransportLayer — executes capability invocations
 *   - TokenService   — issues + verifies capability tokens
 */

import { randomUUID } from '../utils/id';
import { eventBus } from '@/core/runtime/EventBus';
import { ResourceScheduler } from '../services/ResourceScheduler';
import { PolicyEngine } from '../services/PolicyEngine';
import { CapabilityTokenService } from '../services/CapabilityTokenService';
import { IntelligenceBus } from '../services/IntelligenceBus';
import { eventReducer } from '../world/EventReducer';
import { worldModel } from '../world/WorldModel';
import type {
  KernelABI,
  Entity, EntityId, EntityManifest, EntityQuery,
  Intent, IntentId, IntentDraft,
  Capability, CapabilityId, CapabilityManifest,
  Knowledge, KnowledgeId, KnowledgeDraft, KnowledgeQuery,
  Resource, ResourceId, ResourceType, ResourceRequirement, ResourceToken,
  Policy, PolicyId, PolicyDraft, PolicyAction,
  KernelEvent, EventId, EventDraft,
  PluginId, PluginManifest,
  TransportManifest, PlannerManifest,
  CapabilityToken, TokenScope,
  Context, ExecutionPolicy,
  TrustVector, EvidenceId,
} from './v1';

// ─── Internal Storage & Services ──────────────────────────────────────────────

// In Phase 5, these Maps act exclusively as in-memory indexes pointing to WorldModel GraphNodes.
// They are NOT the source of truth.
const entitiesIndex    = new Map<EntityId, string>();
const intentsIndex     = new Map<IntentId, string>();
const capabilitiesIndex = new Map<CapabilityId, string>();
const knowledgeIndex   = new Map<KnowledgeId, string>();
const plugins          = new Map<PluginId, PluginManifest>();
const transports       = new Map<string, TransportManifest>();

// ─── Plugin Registrations ─────────────────────────────────────────────────────

let activePlanner: PlannerManifest | null = null;

type PlannerHandler = (intent: Intent, kernel: KernelABI) => Promise<void>;
let plannerHandler: PlannerHandler | null = null;

/** Register a planner handler function (called by planner plugins). */
export function bindPlannerHandler(handler: PlannerHandler): void {
  plannerHandler = handler;
}

type TransportHandler = (
  capabilityId: CapabilityId,
  entityId: EntityId,
  params: unknown,
  context: Context
) => Promise<{ success: boolean; payload: unknown; latencyMs: number; error?: string }>;

const transportHandlers = new Map<string, TransportHandler>();

/** Register a transport handler function (called by transport plugins). */
export function bindTransportHandler(transportId: string, handler: TransportHandler): void {
  transportHandlers.set(transportId, handler);
}

// ─── Default Trust Vector ─────────────────────────────────────────────────────

const DEFAULT_TRUST: TrustVector = {
  confidence: 1.0,
  reputation: 1.0,
  verification: 1.0,
  reliability: 1.0,
  security: 1.0,
  compliance: 1.0,
  privacy: 1.0,
};

// ─── Kernel Implementation ────────────────────────────────────────────────────

class CHATRKernel implements KernelABI {
  readonly version = '1.0.0' as const;
  private resourceScheduler = new ResourceScheduler();
  private policyEngine = new PolicyEngine();
  private tokenService = new CapabilityTokenService();
  private intelligenceBus = new IntelligenceBus();

  constructor() {
    // Phase 3A: Boot the event reducer to start capturing graph mutations
    eventReducer.boot(this);
  }

  // Allow tests/bootstrap to access the World Model
  public getWorldModel() {
    return worldModel;
  }

  // ── § Entity ───────────────────────────────────────────────────────────────

  async registerEntity(manifest: EntityManifest): Promise<EntityId> {
    const id = `ent_${randomUUID()}` as EntityId;
    const entity: Entity = {
      ...manifest,
      id,
      createdAt: Date.now(),
    };
    
    // Fire event (EventReducer will catch this and write to WorldModel)
    await this.publishEvent({
      type: 'entity.registered',
      source: id,
      payload: entity, // Pass full entity as payload for Graph properties
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    // Update index
    entitiesIndex.set(id, id);

    if (import.meta.env.DEV) {
      console.debug(`[Kernel] Entity registered: ${id} (${entity.type})`);
    }
    return id;
  }

  async resolveEntity(query: EntityQuery): Promise<Entity[]> {
    // 1. Query the World Model
    const nodeIds = Array.from(entitiesIndex.values());
    let results: Entity[] = nodeIds
      .map(id => worldModel.findEntity(id))
      .filter(Boolean)
      .map(node => node!.properties as Entity);

    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }
    if (query.hasCapability) {
      results = results.filter(e => e.capabilities.includes(query.hasCapability!));
    }
    if (query.minTrust !== undefined) {
      results = results.filter(e => {
        const avg = (
          e.trust.confidence + e.trust.reputation +
          e.trust.reliability + e.trust.security
        ) / 4;
        return avg >= query.minTrust!;
      });
    }
    if (query.state) {
      results = results.filter(e => e.state === query.state);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async updateEntity(
    id: EntityId,
    delta: Partial<Omit<Entity, 'id' | 'type' | 'createdAt'>>
  ): Promise<void> {
    const node = worldModel.findEntity(id);
    if (!node) throw new Error(`[Kernel] Entity not found: ${id}`);
    const entity = node.properties as Entity;
    // We would emit an event for this to be picked up by EventReducer, but for now:
    await this.publishEvent({
      type: 'entity.updated',
      source: id,
      payload: { ...entity, ...delta },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });
  }

  // ── § Intent ───────────────────────────────────────────────────────────────

  async submitIntent(draft: IntentDraft): Promise<IntentId> {
    const id = `int_${randomUUID()}` as IntentId;
    const intent: Intent = {
      id,
      ...draft,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // The EventReducer would theoretically sync this to WorldModel if we added an Intent handler.
    // For now, we just index it.
    intentsIndex.set(id, id);

    await this.publishEvent({
      type: 'intent.submitted',
      source: draft.source,
      payload: intent,
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    // Kick off planner
    if (plannerHandler) {
      plannerHandler(intent, this).catch(err => {
        console.error('[Kernel] Planner failure:', err);
      });
    }

    return id;
  }

  async queryIntent(id: IntentId): Promise<Intent | undefined> {
    const node = worldModel.getNode(id);
    if (!node || node.type !== 'Intent') return undefined;
    return node.properties as Intent;
  }

  async cancelIntent(id: IntentId, reason: string): Promise<void> {
    await this.publishEvent({
      type: 'intent.cancelled',
      source: 'kernel' as EntityId,
      intentId: id,
      payload: { reason },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });
  }

  private _updateIntentState(id: IntentId, state: Intent['status']): void {
    eventBus.publish('intent.state_changed', {
      intentId: id,
      state,
      timestamp: Date.now(),
    });
  }

  // ── § Process ──────────────────────────────────────────────────────────────

  async spawnProcess(intentId: IntentId, type: ProcessType): Promise<ProcessId> {
    const id = `proc_${randomUUID()}` as ProcessId;
    
    // We emit an event to the bus, which ProcessService will pick up.
    await this.publishEvent({
      type: 'process.spawned',
      source: 'kernel' as EntityId,
      intentId,
      processId: id,
      payload: { type, state: 'SPAWNING', createdAt: Date.now() },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });
    
    return id;
  }

  async queryProcess(id: ProcessId): Promise<ProcessNode> {
    // Phase 1 implementation: query the WorldModel for the process node
    const node = worldModel.getNode(id);
    if (!node) throw new Error(`[Kernel] Process not found: ${id}`);
    return node.properties as ProcessNode;
  }

  async killProcess(id: ProcessId, reason: string): Promise<void> {
    await this.publishEvent({
      type: 'process.cancelled',
      source: 'kernel' as EntityId,
      processId: id,
      payload: { reason },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });
  }

  // ── § Capability ───────────────────────────────────────────────────────────

  async registerCapability(manifest: CapabilityManifest): Promise<CapabilityId> {
    const cap: Capability = {
      id: manifest.id,
      ...manifest,
    };
    capabilitiesIndex.set(cap.id, cap.id);

    await this.publishEvent({
      type: 'capability.registered',
      source: 'kernel' as EntityId,
      payload: cap,
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    if (import.meta.env.DEV) {
      console.debug(`[Kernel] Capability registered: ${cap.id} (${cap.primitive})`);
    }
    return cap.id;
  }

  async resolveCapability(
    id: CapabilityId,
    context: Context,
    policy?: ExecutionPolicy
  ): Promise<Entity[]> {
    // Phase 6: Decomposed Capability Resolution Engine (CRE)
    
    // 1. Discovery Phase
    const { resolutionDiscovery } = await import('../cre/ResolutionDiscovery');
    const candidates = resolutionDiscovery.discoverCandidates(id);

    // 2. Ranking Phase
    const { resolutionRanking } = await import('../cre/ResolutionRanking');
    const intentPriority = policy?.priority || 0.5; // default to medium priority
    const rankedCandidates = resolutionRanking.rankCandidates(candidates, intentPriority);

    // 3. Selection Phase
    const { resolutionSelection } = await import('../cre/ResolutionSelection');
    const selected = resolutionSelection.selectCandidate(
      rankedCandidates, 
      (context.metadata as any)?.intentId || 'unknown_intent',
      (context.metadata as any)?.processId || 'unknown_process'
    );

    // Legacy event for UI
    await this.publishEvent({
      type: 'capability.resolved',
      source: context.entityId,
      payload: { 
        capabilityId: id, 
        candidates: rankedCandidates.length, 
        policy: policy?.optimize || 'balanced',
        selectedSource: selected ? {
          id: selected.entityId,
          trust: selected.trust,
          health: selected.health,
          economy: { costEstimate: selected.costEstimate }
        } : null,
        intentId: (context.metadata as any)?.intentId,
        processId: (context.metadata as any)?.processId
      },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    // Return the selected entity (wrapped in array for legacy signature)
    if (!selected) return [];
    
    const node = worldModel.findEntity(selected.entityId as EntityId);
    if (!node) return [];

    return [node.properties as Entity];
  }

  async invokeCapability(
    capabilityId: CapabilityId,
    entityId: EntityId,
    params: unknown,
    token: CapabilityToken,
    context: Context
  ): Promise<EvidenceId> {
    // 1. Verify token
    const valid = await this.tokenService.verify(token);
    if (!valid) throw new Error(`[Kernel] Invalid or expired capability token: ${token.id}`);

    const processId = context.metadata?.processId as ProcessId | undefined;
    const intentId = (context.metadata?.intentId || context.sessionId) as IntentId | undefined;

    // 2. Publish execution started
    await this.publishEvent({
      type: 'execution.started',
      source: entityId,
      intentId,
      processId,
      payload: { capabilityId, entityId },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    // 3. Find the transport for this entity
    const entityNode = worldModel.findEntity(entityId);
    if (!entityNode) throw new Error(`[Kernel] Entity not found: ${entityId}`);
    const entity = entityNode.properties as Entity;

    const transportId = (entity.metadata as any)?.transport as string | undefined;

    let result: { success: boolean; payload: unknown; latencyMs: number; error?: string } = {
      success: false,
      payload: null,
      latencyMs: 0,
      error: 'No transport registered for entity',
    };

    if (transportId && transportHandlers.has(transportId)) {
      const handler = transportHandlers.get(transportId)!;
      result = await handler(capabilityId, entityId, params, context);
    }

    // 4. Store evidence
    const evidenceId = `ev_${randomUUID()}` as EvidenceId;
    await this.storeKnowledge({
      type: 'evidence',
      source: entityId,
      content: {
        evidenceId,
        capabilityId,
        entityId,
        params,
        result: result.payload,
        success: result.success,
        latencyMs: result.latencyMs,
        error: result.error,
        timestamp: Date.now(),
      },
      confidence: result.success ? 0.95 : 0.0,
      trust: DEFAULT_TRUST,
      lineage: [],
    });

    // 5. Publish outcome
    await this.publishEvent({
      type: result.success ? 'execution.succeeded' : 'execution.failed',
      source: entityId,
      intentId,
      processId,
      payload: {
        evidenceId,
        capabilityId,
        payload: result.payload,
        latencyMs: result.latencyMs,
        error: result.error,
      },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    return evidenceId;
  }

  // ── § Knowledge ────────────────────────────────────────────────────────────

  async storeKnowledge(draft: KnowledgeDraft): Promise<KnowledgeId> {
    const id = `kn_${randomUUID()}` as KnowledgeId;
    const node: Knowledge = {
      ...draft,
      id,
      createdAt: Date.now(),
    };
    
    knowledgeIndex.set(id, id);

    await this.publishEvent({
      type: 'knowledge.stored',
      source: draft.source,
      payload: node,
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    return id;
  }

  async queryKnowledge(query: KnowledgeQuery): Promise<Knowledge[]> {
    // 1. Query the World Model
    const nodeIds = Array.from(knowledgeIndex.values());
    let results: Knowledge[] = nodeIds
      .map(id => worldModel.getNode(id))
      .filter(Boolean)
      .map(n => n!.properties as Knowledge);

    const now = Date.now();
    
    if (query.domain) {
      results = results.filter(k => k.domain === query.domain);
    }
    if (query.type) {
      results = results.filter(k => k.type === query.type);
    }
    if (query.source) {
      results = results.filter(k => k.source === query.source);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter(k => query.tags!.every(tag => k.tags.includes(tag)));
    }
    if (query.minConfidence !== undefined) {
      results = results.filter(k => (k.confidence || 1.0) >= query.minConfidence!);
    }
    if (query.maxAge !== undefined) {
      results = results.filter(k => now - k.createdAt <= query.maxAge!);
    }
    if (query.relatedTo?.length) {
      results = results.filter(k =>
        query.relatedTo!.some(rel => k.lineage?.includes(rel))
      );
    }
    
    // Filter expired knowledge
    results = results.filter(k => !k.expiresAt || k.expiresAt > now);

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async verifyKnowledge(id: KnowledgeId, verifier: EntityId): Promise<void> {
    const node = knowledge.get(id);
    if (!node) throw new Error(`[Kernel] Knowledge not found: ${id}`);

    // Boost confidence and trust when verified
    knowledge.set(id, {
      ...node,
      confidence: Math.min(1.0, node.confidence + 0.05),
      trust: {
        ...node.trust,
        verification: Math.min(1.0, node.trust.verification + 0.1),
      },
    });

    await this.publishEvent({
      type: 'knowledge.verified',
      source: verifier,
      payload: { knowledgeId: id },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });
  }

  // ── § Resource ─────────────────────────────────────────────────────────────

  async allocateResources(
    intentId: IntentId,
    requirements: ResourceRequirement[]
  ): Promise<ResourceToken> {
    const token = this.resourceScheduler.allocate(intentId, requirements);

    await this.publishEvent({
      type: 'resource.allocated',
      source: 'kernel' as EntityId,
      intentId,
      payload: { resources: token.resources, requirements },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    return token;
  }

  async releaseResources(token: ResourceToken): Promise<void> {
    this.resourceScheduler.release(token);

    await this.publishEvent({
      type: 'resource.released',
      source: 'kernel' as EntityId,
      payload: { token: token.id },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });
  }

  async queryResources(type?: ResourceType): Promise<Resource[]> {
    return this.resourceScheduler.query(type);
  }

  // ── § Policy ───────────────────────────────────────────────────────────────

  async registerPolicy(draft: PolicyDraft): Promise<PolicyId> {
    const id = this.policyEngine.register(draft);

    await this.publishEvent({
      type: 'policy.registered',
      source: draft.authority,
      payload: { id, scope: draft.scope, effect: draft.effect },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    return id;
  }

  async evaluatePolicies(
    action: PolicyAction
  ): Promise<'allow' | 'deny' | 'escalate'> {
    const effect = this.policyEngine.evaluate(action);
    const policy = this.policyEngine.getMatchedPolicy(action);

    if (policy) {
      await this.publishEvent({
        type: 'governance.decision',
        source: 'kernel' as EntityId,
        payload: {
          policyId: policy.id,
          effect: policy.effect,
          action: { capabilityId: action.capability, actor: action.actor },
        },
        trust: DEFAULT_TRUST,
        cost: { resources: [], totalUSD: 0 },
      });
    }

    return effect;
  }

  // ── § Event ────────────────────────────────────────────────────────────────

  async publishEvent(draft: EventDraft): Promise<EventId> {
    return this.intelligenceBus.publish(draft);
  }

  subscribeEvents(
    pattern: string,
    handler: (event: KernelEvent) => void
  ): () => void {
    return this.intelligenceBus.subscribe(pattern, handler);
  }

  // ── § Plugin ───────────────────────────────────────────────────────────────

  async installPlugin(manifest: PluginManifest): Promise<PluginId> {
    const id = `plg_${randomUUID()}` as PluginId;
    plugins.set(id, manifest);

    await this.publishEvent({
      type: 'plugin.installed',
      source: 'kernel' as EntityId,
      payload: { id: manifest.id, type: manifest.type, version: manifest.version },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    console.log(`[Kernel] Plugin installed: ${manifest.id} v${manifest.version} (${manifest.type})`);
    return id;
  }

  async registerTransport(transport: TransportManifest): Promise<void> {
    transports.set(transport.id, transport);

    await this.publishEvent({
      type: 'transport.registered',
      source: 'kernel' as EntityId,
      payload: { id: transport.id, protocols: transport.protocols },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    console.log(`[Kernel] Transport registered: ${transport.id}`);
  }

  async registerPlanner(planner: PlannerManifest): Promise<void> {
    activePlanner = planner;

    await this.publishEvent({
      type: 'planner.registered',
      source: 'kernel' as EntityId,
      payload: { id: planner.id, version: planner.version },
      trust: DEFAULT_TRUST,
      cost: { resources: [], totalUSD: 0 },
    });

    console.log(`[Kernel] Planner registered: ${planner.id}`);
  }

  // ── § Security ─────────────────────────────────────────────────────────────

  async issueCapabilityToken(
    entityId: EntityId,
    capabilityId: CapabilityId,
    scope: TokenScope
  ): Promise<CapabilityToken> {
    return this.tokenService.issue(entityId, capabilityId, scope);
  }

  async verifyCapabilityToken(token: CapabilityToken): Promise<boolean> {
    return this.tokenService.verify(token);
  }
}

// ─── Singleton Kernel Instance ────────────────────────────────────────────────

export const kernel = new CHATRKernel();
