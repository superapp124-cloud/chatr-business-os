/**
 * NodeExecutor — Phase A.5
 *
 * Executes a single node. Nothing else.
 * Looks up the NodeDefinition from a NodeRegistry, calls definition.execute(),
 * and returns a NodeResult. Never manages context, retries, or events.
 *
 * The registry is injected — NodeExecutor has no knowledge of specific node types.
 * This is the architectural boundary that makes the runtime generic (Invariant I-03, I-04).
 *
 * Plane: Execution Plane
 * Imports: platform/contracts, platform/execution/ExecutionPlanner
 */

import type { ExecutionContext } from '../contracts/ExecutionContext.abi';
import type { PlannedTask } from './ExecutionPlanner';
import { PermissionEnforcer } from './PermissionEnforcer';

// ─── Minimal NodeDefinition interface needed by NodeExecutor ──────────────────
// (The full NodeDefinition ABI lives in platform/contracts/NodeDefinition.abi.ts)
// NodeExecutor imports only what it needs to remain decoupled from the full ABI.

export interface INodeExecutable {
  type: string;
  execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<{ output: Record<string, unknown>; providerUsed?: string; tokensUsed?: number; costUsd?: number }>;
}

// ─── Minimal registry interface needed by NodeExecutor ────────────────────────

export interface INodeRegistry {
  get(type: string): INodeExecutable | undefined;
  getPermissions?(type: string): string[];
}

// ─── NodeExecutor result ──────────────────────────────────────────────────────

export interface NodeExecutorResult {
  nodeId: string;
  output: Record<string, unknown>;
  providerUsed?: string;
  tokensUsed?: number;
  costUsd?: number;
}

// ─── NodeExecutor ─────────────────────────────────────────────────────────────

export class NodeExecutor {
  constructor(private readonly registry: INodeRegistry) {}

  /**
   * Execute one node task.
   *
   * 1. Looks up the NodeDefinition from the registry.
   * 2. Falls back to a warn-and-passthrough if no definition is registered.
   * 3. Calls definition.execute(config, context) and returns the result.
   *
   * Context is read-only here. The caller (ExecutionRuntime) writes
   * the result back to context.nodeOutputs after this resolves.
   */
  async execute(task: PlannedTask, context: ExecutionContext): Promise<NodeExecutorResult> {
    const definition = this.registry.get(task.nodeType);

    if (!definition) {
      // Unknown node type — warn but do not throw so partially-defined workflows
      // can still execute the nodes they have definitions for.
      // Once Phase D (NodeRegistry) is complete, this should become a hard error.
      console.warn(
        `[NodeExecutor] No definition registered for node type "${task.nodeType}" (nodeId: ${task.nodeId}). ` +
          'Returning passthrough result. Register this type in NodeRegistry to execute it.',
      );
      return {
        nodeId: task.nodeId,
        output: { executed: false, reason: 'no_definition', type: task.nodeType },
      };
    }

    const grantedPermissions = this.registry.getPermissions ? this.registry.getPermissions(task.nodeType) : [];

    const wrappedContext: ExecutionContext = {
      ...context,
      capabilities: {
        request: (capabilityUri: string) => {
          PermissionEnforcer.assertPermission(grantedPermissions, capabilityUri, task.nodeType);
          return context.capabilities.request ? context.capabilities.request(capabilityUri) : undefined;
        }
      }
    };

    const result = await definition.execute(task.config, wrappedContext);

    return {
      nodeId: task.nodeId,
      output: result.output,
      providerUsed: result.providerUsed,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
    };
  }
}
