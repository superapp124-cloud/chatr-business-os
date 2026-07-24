/**
 * CHATR OS — Goal Planner Runtime
 * 
 * Converts an enriched Intent into a Directed Acyclic Graph (DAG) of execution steps.
 * Never executes. Only produces the IExecutionGraph.
 */
import { IBusinessContext } from './ContextRuntime';

export interface IExecutionNode {
  id: string;
  type: 'authorize' | 'agent' | 'tool' | 'store' | 'sanitize' | 'workflow' | 'policy' | 'human';
  name: string;
  description: string;
  payload: any;
  dependencies: string[]; // Node IDs that must complete before this one starts
  compensation?: string; // Node ID of the compensation function if this fails
}

export interface IExecutionGraph {
  id: string;
  intent: string;
  nodes: IExecutionNode[];
}

export class GoalPlanner {
  /**
   * Agent Profile Registry
   * Maps capability to a specific agent persona system prompt.
   */
  static getAgentProfile(capabilityId: string): string {
    const profiles: Record<string, string> = {
      'HR.ATS': 'You are an expert ATS Recruiter. Generate professional, inclusive, and accurate recruitment content.',
      'Support.Helpdesk': 'You are an efficient IT Helpdesk Agent. Provide concise, actionable IT support tickets.',
      'Finance.Invoicing': 'You are a meticulous Finance Clerk. Ensure all financial data is precise and compliant.'
    };
    return profiles[capabilityId] || 'You are a helpful CHATR OS AI Assistant.';
  }

  /**
   * Generates a deterministic Execution Graph (DAG).
   */
  static createPlan(context: IBusinessContext): IExecutionGraph {
    const nodes: IExecutionNode[] = [];
    const action = context.intent.action;

    // Node 0: Mandatory Authorization Gate
    nodes.push({
      id: 'node_auth',
      type: 'authorize',
      name: 'Check Permissions',
      description: 'Ensure the user has rights to perform this action on this capability.',
      payload: { capabilityId: context.capabilityId, action, roles: context.user.roles },
      dependencies: []
    });

    if (action === 'create') {
      // Create DAG: Authorize -> Load Profile -> Generate Object -> Sanitize -> Store -> Emit Event
      
      nodes.push({
        id: 'node_generate',
        type: 'agent',
        name: 'Draft Content',
        description: `Generate a draft for a new ${context.businessObject}`,
        payload: { 
          profile: this.getAgentProfile(context.capabilityId),
          subject: context.intent.subject,
          objectType: context.businessObject
        },
        dependencies: ['node_auth']
      });

      nodes.push({
        id: 'node_sanitize',
        type: 'sanitize',
        name: 'Sanitize Generation',
        description: 'Ensure generated content matches schema and contains no harmful injections.',
        payload: { objectType: context.businessObject },
        dependencies: ['node_generate']
      });

      nodes.push({
        id: 'node_store',
        type: 'store',
        name: 'Create Record',
        description: `Save the new ${context.businessObject} into the Business Object Store.`,
        payload: { 
          capabilityId: context.capabilityId, 
          objectName: context.businessObject,
          operation: 'create',
          inputRef: 'node_sanitize' // Pull data from sanitize node
        },
        dependencies: ['node_sanitize'],
        compensation: 'node_store_rollback' // Example of Saga compensation mapping
      });

      // No explicit 'Emit Event' node here because StoreExecutor or ExecutionRuntime handles the generic emission,
      // but if we wanted to chain a separate notification tool:
      // nodes.push({ id: 'node_notify', type: 'tool', name: 'Notify Team', ... dependencies: ['node_store'] })

    } else if (action === 'update' || action === 'approve' || action === 'reject' || action === 'assign') {
      // Update DAG: Authorize -> Fetch -> Generate Diff -> Sanitize -> Store
      nodes.push({
        id: 'node_fetch',
        type: 'store',
        name: 'Fetch Target Record',
        description: 'Locate the specific record to modify',
        payload: { capabilityId: context.capabilityId, objectName: context.businessObject, operation: 'read', query: context.intent.target || context.intent.subject },
        dependencies: ['node_auth']
      });

      nodes.push({
        id: 'node_update',
        type: 'store',
        name: 'Update Record',
        description: 'Apply the modification',
        payload: { capabilityId: context.capabilityId, objectName: context.businessObject, operation: 'update', inputRef: 'node_fetch', updateAction: action },
        dependencies: ['node_fetch']
      });

    } else {
      // Read or unrecognized fallback DAG
      nodes.push({
        id: 'node_read',
        type: 'store',
        name: 'Read Records',
        description: 'Fetch records matching the intent',
        payload: { capabilityId: context.capabilityId, objectName: context.businessObject, operation: 'read', query: context.intent.subject },
        dependencies: ['node_auth']
      });
    }

    return {
      id: `dag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      intent: `${action}_${context.businessObject}`,
      nodes
    };
  }
}
