/**
 * CHATR Kernel Runtime v2.0 — AIEngine
 *
 * Layer 3 — Core Engines
 *
 * Orchestrates AI execution. Tools self-register here. 
 * AI asks Tool Registry what's available based on Mode and Permissions.
 */

import { IEngine, EngineHealth, EngineStatus, Permission } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';
import { AIContextPackage } from './AIContextManager';

export interface AITool {
  id: string;
  description: string;
  requiredPermission?: Permission;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export type AIMode = 'conversation' | 'meeting' | 'workspace' | 'research' | 'crm' | 'knowledge' | 'search' | 'automation' | 'developer';

export class AIEngineImpl implements IEngine {
  readonly id = 'AIEngine';
  readonly version = '2.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = ['AIContextManager'];

  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;
  private tools = new Map<string, AITool>();
  private currentMode: AIMode = 'conversation';

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { return {}; }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;
    
    // Register base tools
    this.registerTool({
      id: 'search',
      description: 'Search across all data',
      execute: async (params) => this.kernel.search((params.query as string) || '')
    });
    
    this._status = 'ready';
  }

  // ── Tool Registry ─────────────────────────────────────────────────────────

  registerTool(tool: AITool): void {
    this.tools.set(tool.id, tool);
  }

  getAvailableTools(): AITool[] {
    const available: AITool[] = [];
    for (const tool of this.tools.values()) {
      // Check permissions
      if (!tool.requiredPermission || this.kernel.permissions.check(this.id, tool.requiredPermission)) {
        available.push(tool);
      }
    }
    
    // Filter by mode
    // Meeting mode: [Calendar, Contacts, CRM, Tasks]
    // Research mode: [Search, Files, Knowledge, Browser]
    return available;
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  setMode(mode: AIMode): void {
    this.currentMode = mode;
  }

  async generate(prompt: string, opts?: { mode?: AIMode; contactId?: string }): Promise<{ response: string; confidence: number; reason: string }> {
    const mode = opts?.mode || this.currentMode;
    
    // 1. Get Context
    const aiContextManager = this.kernel.getEngine<{ assembleContext(q: string, c?: string): Promise<AIContextPackage> }>('AIContextManager');
    const context = await aiContextManager.assembleContext(prompt, opts?.contactId);
    
    // 2. Get Tools
    const availableTools = this.getAvailableTools();
    
    // 3. Stub AI execution - in real app, calls LLM with prompt + context + tools
    console.log(`[AIEngine] Generating response in ${mode} mode with ${availableTools.length} tools and active context`);
    
    // Simulate generation with confidence metadata
    return {
      response: `AI Response to: ${prompt}`,
      confidence: 94,
      reason: `Assembled context matched 94% of prompt intent via ${mode} routing.`
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    await this.dispose();
    await this.init(this.kernel);
  }

  async dispose(): Promise<void> {
    this._status = 'stopped';
    this.tools.clear();
  }
}

export const aiEngine = new AIEngineImpl();
