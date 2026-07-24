
import { AIContext, IntentPlan, MappingResult, HealingRecommendation, ExecutionFailure, WorkflowGraph } from './Types';
import { generate } from '@/services/ai';

export interface AIProvider {
  plan(intent: string, context: AIContext): Promise<IntentPlan>;
  map(sourceSchema: any, targetSchema: any): Promise<MappingResult>;
  heal(failure: ExecutionFailure, context: AIContext): Promise<HealingRecommendation>;
}

// --- Real AI Provider (Phase B) ---
// Calls the local CHATR AI service (no cloud, privacy-first).
// Falls back gracefully to the deterministic mock if the LLM is not available.
export class RealAIProvider implements AIProvider {
  async plan(intent: string, _context: AIContext): Promise<IntentPlan> {
    console.log('[RealAIProvider] Reasoning over intent:', intent);

    const systemPrompt = `You are the Automation OS Intent Planner. Convert this user intent into a JSON workflow graph.

User intent: "${intent}"

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "name": "Workflow name based on intent",
  "nodes": [
    { "id": "step_1", "type": "core.trigger", "label": "Trigger: <describe trigger>", "name": "<short name>" },
    { "id": "step_2", "type": "core.ai_agent", "label": "AI: <describe task>", "name": "<short name>" },
    { "id": "step_3", "type": "core.email", "label": "Email: <describe email>", "name": "<short name>" }
  ],
  "edges": [
    { "id": "e1", "source": "step_1", "target": "step_2" },
    { "id": "e2", "source": "step_2", "target": "step_3" }
  ]
}

Generate 3-6 nodes appropriate to the intent. Use types: core.trigger, core.ai_agent, core.email, core.condition, core.webhook, core.database.`;

    try {
      const rawJson = await generate({ prompt: systemPrompt });

      // Extract JSON even if the LLM wraps it in markdown
      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('LLM returned no valid JSON');

      const parsed = JSON.parse(jsonMatch[0]);

      const graph: WorkflowGraph = {
        nodes: (parsed.nodes || []).map((n: any, i: number) => ({
          id: n.id || `step_${i + 1}`,
          type: n.type || 'core.ai_agent',
          position: { x: 100, y: i * 150 },
          data: { label: n.label || n.name || `Step ${i + 1}`, name: n.name || `Step ${i + 1}` }
        })),
        edges: parsed.edges || []
      };

      return {
        id: 'plan_' + Date.now(),
        originalText: intent,
        confidence: 0.92,
        status: 'ready',
        graph
      };

    } catch (err) {
      console.warn('[RealAIProvider] LLM fallback triggered:', err);
      // Deterministic fallback — still better than a crash
      return new MockAIProvider().plan(intent, _context);
    }
  }

  async map(sourceSchema: any, targetSchema: any): Promise<MappingResult> {
    const prompt = `Map these two schemas and return a confidence score 0-1. Source: ${JSON.stringify(sourceSchema)}. Target: ${JSON.stringify(targetSchema)}. Reply in 1 sentence with the mapping strategy.`;
    try {
      const reason = await generate({ prompt });
      return {
        confidence: 0.92,
        reason: reason || 'Semantic field mapping applied.',
        evidence: 'LLM semantic analysis',
        transformations: ['type-coercion'],
        status: 'auto'
      };
    } catch {
      return {
        confidence: 0.75,
        reason: 'Structural similarity detected. Manual verification recommended.',
        evidence: 'Fallback heuristic',
        transformations: [],
        status: 'manual_required'
      };
    }
  }

  async heal(failure: ExecutionFailure, _context: AIContext): Promise<HealingRecommendation> {
    const prompt = `A workflow node failed with error: "${failure.error}". Node ID: ${failure.nodeId}. Suggest a 1-sentence fix and the JSON patch to apply.`;
    try {
      const suggestion = await generate({ prompt });
      return {
        confidence: 0.88,
        reason: suggestion || 'Schema mismatch detected. Check field names.',
        patch: { suggestion }
      };
    } catch {
      return {
        confidence: 0.6,
        reason: 'Check field mapping and API credentials for the failing node.',
        patch: {}
      };
    }
  }
}

// --- Mock AI Provider (kept as fallback) ---
export class MockAIProvider implements AIProvider {
  async plan(intent: string, _context: AIContext): Promise<IntentPlan> {
    console.log('[MockAIProvider] Fallback: deterministic plan for:', intent);
    await new Promise(resolve => setTimeout(resolve, 400));

    const mockGraph: WorkflowGraph = {
      nodes: [
        { id: 'trigger_1', type: 'core.trigger',   position: { x: 100, y: 100 }, data: { name: 'On Trigger', label: 'Trigger: ' + intent.slice(0, 30) } },
        { id: 'agent_1',   type: 'core.ai_agent',  position: { x: 300, y: 100 }, data: { name: 'Process',    label: 'AI: Process intent' } },
        { id: 'email_1',   type: 'core.email',      position: { x: 500, y: 100 }, data: { name: 'Notify',     label: 'Email: Send result' } },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'agent_1' },
        { id: 'e2', source: 'agent_1',   target: 'email_1' }
      ]
    };

    return {
      id: 'plan_' + Date.now(),
      originalText: intent,
      confidence: 0.75,
      status: 'ready',
      graph: mockGraph
    };
  }

  async map(sourceSchema: any, targetSchema: any): Promise<MappingResult> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      confidence: 0.97,
      reason: 'Semantic match (emailAddress -> recipient)',
      evidence: 'Input field names + semantic similarity',
      transformations: ['string -> lowercase'],
      status: 'auto'
    };
  }

  async heal(failure: ExecutionFailure, _context: AIContext): Promise<HealingRecommendation> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      confidence: 0.88,
      reason: "API Schema mismatch. 'firstName' was expected but 'first_name' was provided.",
      patch: { fieldMapping: { 'first_name': '{{trigger.output.first_name}}' } }
    };
  }
}

// --- Active Provider (switched to Real for production) ---
export const ActiveAIProvider: AIProvider = new RealAIProvider();
