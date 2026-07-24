/**
 * CHATR Kernel Runtime v2.0 — KnowledgeEngine
 *
 * Layer 3 — Core Engines
 *
 * Extracts and manages 20 entity types + relationship edges.
 * Forms a graph (nodes + edges) rather than just a list of entities.
 */

import { IEngine, EngineHealth, EngineStatus, KnowledgeNode, KnowledgeEdge, KnowledgeEntityType } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';

export class KnowledgeEngineImpl implements IEngine {
  readonly id = 'KnowledgeEngine';
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

    // Listen for events that should trigger extraction
    this.kernel.events.on('MESSAGE_RECEIVED', (e) => this.queueExtraction(e.payload));
    this.kernel.events.on('DOCUMENT_UPLOADED', (e) => this.queueExtraction(e.payload));
    this.kernel.events.on('TRANSCRIPT_CHUNK_RECEIVED', (e) => {
      // Incremental knowledge extraction from live calls
      this.queueExtraction(e.payload);
    });

    this._status = 'ready';
  }

  // ── Extraction ────────────────────────────────────────────────────────────

  private queueExtraction(payload: unknown): void {
    // Offload to Web Worker Pool
    this.kernel.workers.submit({
      type: 'knowledge:extract',
      payload,
      priority: 'normal',
      onComplete: (result: unknown) => {
        if (result && typeof result === 'object' && 'nodes' in result) {
          const { nodes, edges } = result as { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
          this.mergeGraph(nodes, edges);
        }
      }
    });
  }

  /**
   * Synchronous extraction (used by AIEngine or direct calls).
   * In a real implementation, this would use a fast local NER model or
   * a structured LLM call via AIEngine.
   */
  async extract(text: string, source: string): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    console.log(`[KnowledgeEngine] Extracting from: ${source}`);
    
    // Stub implementation for now - returning an empty graph
    // The actual AI extraction happens in AIEngine or WorkerPool
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    
    return { nodes, edges };
  }

  // ── Graph Management ──────────────────────────────────────────────────────

  private mergeGraph(newNodes: KnowledgeNode[], newEdges: KnowledgeEdge[]): void {
    const current = this.kernel.state.get('knowledge');
    
    // Simple merge for phase 1 (deduplication needed in phase 2)
    const nodes = [...current.nodes, ...newNodes];
    const edges = [...current.edges, ...newEdges];

    this.kernel.state.update('knowledge', () => ({
      nodes,
      edges,
      lastExtracted: Date.now()
    }));

    this.kernel.events.publish('KNOWLEDGE_UPDATED', { nodes, edges }, { priority: 'normal', source: this.id });
  }

  getGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const state = this.kernel.state.get('knowledge');
    return { nodes: state.nodes, edges: state.edges };
  }

  clear(): void {
    this.kernel.state.update('knowledge', () => ({
      nodes: [],
      edges: [],
      lastExtracted: Date.now()
    }));
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

export const knowledgeEngine = new KnowledgeEngineImpl();
