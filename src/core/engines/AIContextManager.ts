/**
 * CHATR Kernel Runtime v2.0 — AIContextManager
 *
 * Layer 3 — Core Engines
 *
 * Implements the strictly Local-First 6-Layer Reasoning Architecture:
 * 1. Current Conversation (UI State)
 * 2. Agent Session (AgentSessionManager)
 * 3. Long-Term Memory (Pinned context/goals)
 * 4. Semantic Memory (Vector search)
 * 5. Knowledge Graph (Entities)
 * 6. Workspace State
 */

import { IEngine, EngineHealth, EngineStatus } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';
import { AgentSession, agentSessionManager } from '../services/AgentSessionManager';

export interface AIContextPackage {
  layer1_currentConversation: { role: string; content: string }[];
  layer2_agentSession: AgentSession | null;
  layer3_longTermMemory: { goals: any[]; openTasks: any[]; pinnedContext: string | null };
  layer4_semanticMemory: unknown[];
  layer5_knowledgeGraph: { entities: any[]; topics: any[] };
  layer6_workspaceState: Record<string, unknown[]>;
  permissions: string[];
}

export class AIContextManagerImpl implements IEngine {
  readonly id = 'AIContextManager';
  readonly version = '2.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = ['MemoryEngine'];

  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { return {}; }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;
    this._status = 'ready';
  }

  /**
   * Assembles the multi-layered context package for the local LLM.
   */
  async assembleContext(
    query: string, 
    userId: string, 
    agentId: string, 
    sessionId?: string
  ): Promise<AIContextPackage> {
    
    const context: AIContextPackage = {
      layer1_currentConversation: [],
      layer2_agentSession: null,
      layer3_longTermMemory: { goals: [], openTasks: [], pinnedContext: null },
      layer4_semanticMemory: [],
      layer5_knowledgeGraph: { entities: [], topics: [] },
      layer6_workspaceState: {},
      permissions: ['execute:search', 'read:timeline']
    };

    try {
      // Import dynamically to avoid circular issues
      const { semanticMemory } = await import('../services/SemanticMemory');

      // Layer 1: Current Conversation & UI State (from Kernel)
      const workingMemory = this.kernel.memory.getWorkingEntities();
      context.layer6_workspaceState = workingMemory;
      
      // Layer 2: Agent Session
      if (sessionId) {
        context.layer2_agentSession = await agentSessionManager.getSession(sessionId);
      }
      
      if (context.layer2_agentSession) {
        const session = context.layer2_agentSession;
        // Layer 3: Long-Term Memory (from session)
        context.layer3_longTermMemory.goals = session.goals || [];
        context.layer3_longTermMemory.openTasks = session.open_tasks || [];
        context.layer3_longTermMemory.pinnedContext = session.pinned_context || null;

        // Layer 5: Knowledge Graph (from session extraction)
        context.layer5_knowledgeGraph.entities = session.entities || [];
        context.layer5_knowledgeGraph.topics = session.topics || [];

        // Layer 1 prep: Grab the latest 10 messages from session to act as immediate conversational context
        context.layer1_currentConversation = (session.messages || []).slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }));
      }

      // Layer 4: Semantic Memory
      // Only augment with vector search if query is substantial, prioritizing structured session data
      if (query.length > 10) {
        context.layer4_semanticMemory = await semanticMemory.search(query, undefined, 3, 0.75);
      }
      
    } catch (err) {
      console.warn(`[AIContextManager] Partial context assembled due to error:`, err);
    }

    return context;
  }

  /**
   * Token-Aware Memory Compression
   * Builds the prompt prioritizing the highest value layers first.
   */
  compileToText(pkg: AIContextPackage, maxTokens = 2048): string {
    let output = '';
    let currentTokens = 0;
    
    // Naive token estimation (4 chars ≈ 1 token)
    const est = (str: string) => Math.ceil(str.length / 4);

    const append = (str: string) => {
      const tokens = est(str);
      if (currentTokens + tokens > maxTokens) return false;
      output += str + '\n';
      currentTokens += tokens;
      return true;
    };

    // 1. Long-Term Memory (Highest priority for goal alignment)
    if (pkg.layer3_longTermMemory.pinnedContext) {
      append(`[PINNED CONTEXT]\n${pkg.layer3_longTermMemory.pinnedContext}`);
    }
    if (pkg.layer3_longTermMemory.goals.length > 0) {
      append(`[GOALS]\n${JSON.stringify(pkg.layer3_longTermMemory.goals)}`);
    }

    // 2. Workspace State (Contextual awareness)
    if (Object.keys(pkg.layer6_workspaceState).length > 0) {
      append(`[WORKSPACE STATE]\n${JSON.stringify(pkg.layer6_workspaceState)}`);
    }

    // 3. Knowledge Graph
    if (pkg.layer5_knowledgeGraph.entities.length > 0) {
      append(`[ENTITIES]\n${JSON.stringify(pkg.layer5_knowledgeGraph.entities)}`);
    }

    // 4. Semantic Memory (Lowest priority, easily dropped if tokens are tight)
    if (pkg.layer4_semanticMemory.length > 0) {
      append(`[SEMANTIC KNOWLEDGE]`);
      for (const match of pkg.layer4_semanticMemory) {
        if (!append(`- ${JSON.stringify((match as any).content)}`)) break;
      }
    }

    // 5. Current Conversation (Always included last so it's closest to the generation point)
    if (pkg.layer1_currentConversation.length > 0) {
      append(`\n[CONVERSATION HISTORY]`);
      for (const msg of pkg.layer1_currentConversation) {
        if (!append(`${msg.role.toUpperCase()}: ${msg.content}`)) break;
      }
    }

    return output;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    await this.dispose();
    await this.init(this.kernel);
  }

  async dispose(): Promise<void> {
    this._status = 'stopped';
  }
}

export const aiContextManager = new AIContextManagerImpl();
