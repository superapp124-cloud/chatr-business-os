import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PackageManager } from '../../src/platform/marketplace/PackageManager';
import { PackageRegistry } from '../../src/platform/marketplace/PackageRegistry';
import { SharedNodeRegistry, BrowserExecutionEngine } from '../../src/platform/execution/BrowserExecutionEngine';
import { CommandBus } from '../../src/platform/AutomationOS/CommandBus';
import type { WorkflowGraph } from '../../src/platform/contracts/WorkflowGraph.abi';
import * as path from 'path';

describe('Phase E5 & E6: Production Readiness Run', () => {
  let registry: PackageRegistry;
  let manager: PackageManager;
  const testRegistryPath = path.join(process.cwd(), '.chatr', 'test-registry-e6.json');

  beforeEach(() => {
    registry = new PackageRegistry(testRegistryPath);
    registry.clear();
    // Clear nodes so we prove installation works
    (SharedNodeRegistry as any).definitions.clear();
    manager = new PackageManager(registry, SharedNodeRegistry);
  });

  afterEach(() => {
    registry.clear();
  });

  it('End-to-End: TalentXcel Services Scenario', async () => {
    // 1. Package discovered & installed
    expect(SharedNodeRegistry.get('core.trigger')).toBeUndefined();
    
    const pkg = await manager.install('core-nodes');
    expect(pkg.manifest.id).toBe('com.chatr.nodes.core');
    expect(pkg.status).toBe('active');

    // 2. Nodes registered (Palette updated)
    expect(SharedNodeRegistry.get('core.trigger')).toBeDefined();
    expect(SharedNodeRegistry.get('core.ai_agent')).toBeDefined();
    expect(SharedNodeRegistry.get('core.condition')).toBeDefined();

    // 3. Workflow created (TalentXcel manual trigger -> AI agent -> Condition)
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'n1', type: 'core.trigger', label: 'Manual Trigger', position: { x: 0, y: 0 }, config: { event: 'manual' } },
        { id: 'n2', type: 'core.ai_agent', label: 'AI Agent', position: { x: 0, y: 0 }, config: { prompt: 'Analyze CV', capabilityId: 'chatr.ai.generate' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' }
      ],
      executionHints: {
        defaultRetry: { maxAttempts: 3, backoffMs: 1000 },
        timeoutMs: 30000
      }
    };

    // 4. Workflow executed (Runtime)
    // We expect it to execute the mock providers we set up in D5
    let auditCount = 0;
    const auditHandler = (audit: any) => { auditCount++; };
    
    // Patch audit log to count
    const origAppend = (BrowserExecutionEngine as any).auditStore.append;
    (BrowserExecutionEngine as any).auditStore.append = async (a: any) => {
      auditHandler(a);
      await origAppend.call((BrowserExecutionEngine as any).auditStore, a);
    };

    await BrowserExecutionEngine.execute(graph, { triggerType: 'manual', triggeredBy: 'tenant_talentxcel' }, 'wf-talentxcel-01');

    // 5. Audits recorded and Execution completed
    expect(auditCount).toBeGreaterThan(0); // Multiple nodes executed

    // 6. Uninstall cleanly removes nodes
    await manager.uninstall('com.chatr.nodes.core');
    expect(SharedNodeRegistry.get('core.trigger')).toBeUndefined();
  });
});
