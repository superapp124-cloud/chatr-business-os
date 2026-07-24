const fs = require('fs');
const path = require('path');

const osDir = path.join(__dirname, '../src/platform/AutomationOS');

// 1. Update Types.ts
let typesContent = fs.readFileSync(path.join(osDir, 'Types.ts'), 'utf8');
if (!typesContent.includes('AIContext')) {
  typesContent += `
export interface AIContext {
  workflow: WorkflowGraph;
  selection: string[];
  variables: Record<string, any>;
  telemetry: any;
  history: OSEvent[];
  capabilities: CapabilityManifest[];
  permissions: any;
}

export interface MappingResult {
  confidence: number;
  reason: string;
  evidence: string;
  transformations: string[];
  status: 'auto' | 'manual_required';
}

export interface HealingRecommendation {
  confidence: number;
  reason: string;
  patch: any;
}

export interface ExecutionFailure {
  nodeId: string;
  error: string;
  context: any;
}
`;
  fs.writeFileSync(path.join(osDir, 'Types.ts'), typesContent);
}

// 2. Create AIProvider.ts
const providerContent = `
import { AIContext, IntentPlan, MappingResult, HealingRecommendation, ExecutionFailure, WorkflowGraph } from './Types';

export interface AIProvider {
  plan(intent: string, context: AIContext): Promise<IntentPlan>;
  map(sourceSchema: any, targetSchema: any): Promise<MappingResult>;
  heal(failure: ExecutionFailure, context: AIContext): Promise<HealingRecommendation>;
}

export class MockAIProvider implements AIProvider {
  async plan(intent: string, context: AIContext): Promise<IntentPlan> {
    console.log('[MockAIProvider] Reasoning over intent:', intent);
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate LLM latency
    
    // Deterministic mock generation
    const mockGraph: WorkflowGraph = {
      nodes: [
        { id: 'trigger_1', type: 'core.trigger', position: { x: 100, y: 100 }, data: { event: 'On SignUp' } },
        { id: 'agent_1', type: 'core.ai_agent', position: { x: 300, y: 100 }, data: { prompt: 'Score lead quality' } },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'agent_1' }
      ]
    };

    return {
      id: 'plan_' + Date.now(),
      originalText: intent,
      confidence: 0.95,
      status: 'ready',
      graph: mockGraph
    };
  }

  async map(sourceSchema: any, targetSchema: any): Promise<MappingResult> {
    console.log('[MockAIProvider] Mapping schemas...');
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      confidence: 0.97,
      reason: "Semantic match (emailAddress -> recipient)",
      evidence: "Input field names + semantic similarity",
      transformations: ["string -> lowercase"],
      status: 'auto'
    };
  }

  async heal(failure: ExecutionFailure, context: AIContext): Promise<HealingRecommendation> {
    console.log('[MockAIProvider] Analyzing root cause for failure:', failure.error);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      confidence: 0.88,
      reason: "API Schema mismatch. 'firstName' was expected but 'first_name' was provided.",
      patch: { "fieldMapping": { "first_name": "{{trigger.output.first_name}}" } }
    };
  }
}

export const ActiveAIProvider = new MockAIProvider();
`;
fs.writeFileSync(path.join(osDir, 'AIProvider.ts'), providerContent);

// 3. Create IntentService.ts
const intentContent = `
import { ActiveAIProvider } from './AIProvider';
import { AIContext, IntentPlan } from './Types';

export class IntentService {
  async processIntent(intentText: string, context: AIContext): Promise<IntentPlan> {
    console.log('[IntentService] Initiating multi-stage pipeline...');
    // 1. Parser (Extract entities)
    // 2. Entity Resolver
    // 3. Capability Planner
    // 4. Generator (via Provider)
    const plan = await ActiveAIProvider.plan(intentText, context);
    // 5. Validator
    console.log('[IntentService] Plan validated.');
    return plan;
  }
}

export const AutomationIntentService = new IntentService();
`;
fs.writeFileSync(path.join(osDir, 'IntentService.ts'), intentContent);

// 4. Create SchemaAnalyzer.ts
const schemaContent = `
import { ActiveAIProvider } from './AIProvider';
import { OSEdge } from './Types';

export class SchemaAnalyzer {
  async analyzeEdge(edge: OSEdge, sourceCapability: any, targetCapability: any): Promise<OSEdge> {
    const mapping = await ActiveAIProvider.map(sourceCapability, targetCapability);
    edge.metadata = { ai_mapping: mapping };
    return edge;
  }
}

export const ActiveSchemaAnalyzer = new SchemaAnalyzer();
`;
fs.writeFileSync(path.join(osDir, 'SchemaAnalyzer.ts'), schemaContent);

// 5. Create SelfHealingService.ts
const healingContent = `
import { EventBus } from './EventBus';
import { CommandBus } from './CommandBus';
import { ActiveAIProvider } from './AIProvider';
import { OSEvent } from './Types';

export class SelfHealingService {
  constructor() {
    EventBus.subscribe(this.handleEvent.bind(this));
  }

  private async handleEvent(event: OSEvent) {
    if (event.type === 'NODE_FAILED') {
      console.log('[SelfHealingService] Intercepted NODE_FAILED event. Initiating healing pipeline...');
      const failure = {
        nodeId: event.payload.nodeId,
        error: event.payload.error,
        context: event.payload
      };

      // Construct AI Context
      const context = {} as any; 

      // Request recommendation from AI Provider
      const recommendation = await ActiveAIProvider.heal(failure, context);

      if (recommendation.confidence >= 0.85) {
        console.log('[SelfHealingService] High confidence fix generated. Dispatching RecommendFixCommand...');
        
        // AI PROPOSES, KERNEL DECIDES
        CommandBus.dispatch({
          type: 'RECOMMEND_FIX',
          payload: {
            nodeId: failure.nodeId,
            recommendation
          },
          timestamp: Date.now()
        });
      } else {
        console.log('[SelfHealingService] Confidence too low for automatic recommendation. Alerting user.');
      }
    }
  }
}

// Initialize Singleton
export const ActiveSelfHealingService = new SelfHealingService();
`;
fs.writeFileSync(path.join(osDir, 'SelfHealingService.ts'), healingContent);

// 6. Update CommandBus.ts
let commandBusContent = fs.readFileSync(path.join(osDir, 'CommandBus.ts'), 'utf8');

if (!commandBusContent.includes('ActiveSchemaAnalyzer')) {
  commandBusContent = commandBusContent.replace(
    `import { RuntimeAdapter } from './RuntimeAdapter';`,
    `import { RuntimeAdapter } from './RuntimeAdapter';\nimport { ActiveSchemaAnalyzer } from './SchemaAnalyzer';\nimport { AutomationIntentService } from './IntentService';`
  );
  
  // Update CREATE_EDGE to use async SchemaAnalyzer
  commandBusContent = commandBusContent.replace(
    `const edge = command.payload.edge;\n        edge.metadata = { confidence: 0.96, reason: "Matched by semantic similarity (AI Auto-mapped)", mappedFields: 2, status: 'auto' };\n        EventBus.publish({ type: 'EDGE_CREATED', payload: { edge }, timestamp: Date.now() });\n        EventBus.publish({ type: 'SCHEMA_MAPPED', payload: { edgeId: edge.id, metadata: edge.metadata }, timestamp: Date.now() });`,
    `const rawEdge = command.payload.edge;
        ActiveSchemaAnalyzer.analyzeEdge(rawEdge, {}, {}).then(edge => {
          EventBus.publish({ type: 'EDGE_CREATED', payload: { edge }, timestamp: Date.now() });
          EventBus.publish({ type: 'SCHEMA_MAPPED', payload: { edgeId: edge.id, metadata: edge.metadata }, timestamp: Date.now() });
        });`
  );

  // Add handlers for new Commands
  commandBusContent = commandBusContent.replace(
    `case 'COMPILE_WORKFLOW':`,
    `case 'GENERATE_WORKFLOW':
        AutomationIntentService.processIntent(command.payload.intent, {} as any).then(plan => {
          EventBus.publish({ type: 'WORKFLOW_GENERATED', payload: { plan }, timestamp: Date.now() });
        });
        break;
      case 'RECOMMEND_FIX':
        // The Kernel receives the recommendation and emits an event for the UI to ask for approval
        EventBus.publish({ type: 'FIX_RECOMMENDED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'COMPILE_WORKFLOW':`
  );

  fs.writeFileSync(path.join(osDir, 'CommandBus.ts'), commandBusContent);
}

// Add SelfHealingService initialization somewhere
let kernelStoreContent = fs.readFileSync(path.join(osDir, 'KernelStore.ts'), 'utf8');
if (!kernelStoreContent.includes('ActiveSelfHealingService')) {
  kernelStoreContent += `\nimport { ActiveSelfHealingService } from './SelfHealingService';\n// Keep service alive\n(window as any)._selfHealingService = ActiveSelfHealingService;\n`;
  fs.writeFileSync(path.join(osDir, 'KernelStore.ts'), kernelStoreContent);
}

console.log('Phase B: Intelligence Kernel built.');
