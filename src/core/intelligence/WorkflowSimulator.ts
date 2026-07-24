import { WorkflowCompiler } from '@/platform/AutomationOS/Compiler';

export interface SimulationContext {
  tenant_id?: string;
  available_providers: string[];
  active_policies: Array<{ scope: string; capability?: string; enforcement: string; rule: Record<string, any> }>;
}

export interface SimulationCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface SimulationResult {
  passed: boolean;
  checks: SimulationCheck[];
  estimated_duration_ms: number | null;
  warnings: string[];
  errors: string[];
}

class WorkflowSimulatorImpl {
  /**
   * Flight-checks a workflow BEFORE it is published.
   * All checks run locally — no cloud calls, no side effects.
   */
  simulate(nodes: any[], edges: any[], context: SimulationContext): SimulationResult {
    const checks: SimulationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // ── Check 1: Graph Validity (Kahn's Algorithm) ─────────────────────────
    try {
      WorkflowCompiler.compile({ nodes, edges });
      checks.push({ name: 'Graph Validity', status: 'pass', message: 'No cycles or disconnected subgraphs detected.' });
    } catch (err: any) {
      checks.push({ name: 'Graph Validity', status: 'fail', message: err.message });
      errors.push(err.message);
    }

    // ── Check 2: Unreachable Nodes ─────────────────────────────────────────
    const targetIds = new Set(edges.map((e: any) => e.target));
    const triggerNodes = nodes.filter((n: any) => n.type === 'trigger');
    const unreachable = nodes.filter(
      (n: any) => !targetIds.has(n.id) && n.type !== 'trigger'
    );
    if (unreachable.length > 0) {
      const ids = unreachable.map((n: any) => n.id).join(', ');
      checks.push({ name: 'Unreachable Nodes', status: 'warn', message: `Nodes with no incoming edges (may be isolated): ${ids}` });
      warnings.push(`Unreachable nodes detected: ${ids}`);
    } else {
      checks.push({ name: 'Unreachable Nodes', status: 'pass', message: 'All nodes are reachable from the trigger.' });
    }

    // ── Check 3: Trigger Node Present ─────────────────────────────────────
    if (triggerNodes.length === 0) {
      checks.push({ name: 'Trigger Node', status: 'fail', message: 'No trigger node found. Every workflow must start with a trigger.' });
      errors.push('Missing trigger node.');
    } else {
      checks.push({ name: 'Trigger Node', status: 'pass', message: `Trigger node found: ${triggerNodes[0].id}` });
    }

    // ── Check 4: Provider Availability ────────────────────────────────────
    const actionNodes = nodes.filter((n: any) => n.type === 'action' || n.type === 'capability');
    const missingProviders: string[] = [];
    for (const node of actionNodes) {
      const requiredProvider = node.data?.provider;
      if (requiredProvider && !context.available_providers.includes(requiredProvider)) {
        missingProviders.push(`Node '${node.id}' requires provider '${requiredProvider}' which is not available.`);
      }
    }
    if (missingProviders.length > 0) {
      checks.push({ name: 'Provider Availability', status: 'fail', message: missingProviders.join(' ') });
      errors.push(...missingProviders);
    } else {
      checks.push({ name: 'Provider Availability', status: 'pass', message: 'All required providers are registered.' });
    }

    // ── Check 5: Policy Pre-flight ─────────────────────────────────────────
    const blockingPolicies: string[] = [];
    for (const node of actionNodes) {
      const capability = node.data?.capability;
      if (!capability) continue;
      for (const policy of context.active_policies) {
        if (
          (policy.capability === capability || !policy.capability) &&
          policy.enforcement === 'block'
        ) {
          blockingPolicies.push(`Node '${node.id}' capability '${capability}' is blocked by policy (scope: ${policy.scope}).`);
        }
      }
    }
    if (blockingPolicies.length > 0) {
      checks.push({ name: 'Policy Compliance', status: 'fail', message: blockingPolicies.join(' ') });
      errors.push(...blockingPolicies);
    } else {
      checks.push({ name: 'Policy Compliance', status: 'pass', message: 'No blocking policies detected for this workflow.' });
    }

    const passed = errors.length === 0;
    return {
      passed,
      checks,
      estimated_duration_ms: null, // Would be populated by PerformanceAnalyzer in production
      warnings,
      errors,
    };
  }
}

export const workflowSimulator = new WorkflowSimulatorImpl();
