/**
 * Enterprise Definition Language (EDL) v0.1 Core Contracts
 *
 * This file defines the serialization contracts for the Core Primitives of the CHATR OS Kernel.
 * Every Living Object in the enterprise is fundamentally defined by these metadata interfaces.
 */

// ─── 1. Identity & Base ───────────────────────────────────────────────────────

export type URN = `urn:chatr:${string}:${string}`;

export interface EDLPrimitive {
  urn: URN;
  type: string;          // e.g., 'candidate', 'employee', 'invoice'
  name: string;          // Human-readable name
  description?: string;  // Semantics and usage
  metadata: Record<string, any>; // Arbitrary non-executable data
}

// ─── 2. Properties (Attributes) ────────────────────────────────────────────────

export type EDLPropertyType = 'string' | 'number' | 'boolean' | 'date' | 'reference' | 'array' | 'object';

export interface EDLProperty {
  key: string;
  type: EDLPropertyType;
  required: boolean;
  indexed?: boolean;
  defaultValue?: any;
  validationRule?: string; // Reference to a Policy URN or simple regex
}

// ─── 3. Relationships ─────────────────────────────────────────────────────────

export type RelationshipClass = 
  | 'structural'
  | 'authority'
  | 'dependency'
  | 'temporal'
  | 'behavioral'
  | 'reference'
  | 'inheritance';

export interface EDLRelationshipDef {
  predicate: string;           // e.g., 'reports_to', 'approved_by'
  class: RelationshipClass;
  targetType: string | URN;    // Allowed target type (e.g., 'employee')
  required: boolean;
  multiple: boolean;           // true for 1:N, false for 1:1
}

// ─── 4. Lifecycle & Events ────────────────────────────────────────────────────

export interface EDLLifecycleState {
  name: string;                // e.g., 'Screening', 'Active', 'Archived'
  isTerminal?: boolean;
}

export interface EDLLifecycleTransition {
  from: string[];              // Allowed previous states
  to: string;
  triggeredByEvent: string;    // Event name that triggers this transition
  requiredPolicies?: URN[];    // Policies that must evaluate to TRUE
}

// ─── 5. The Core Primitives ───────────────────────────────────────────────────

export interface EDLLivingObject extends EDLPrimitive {
  primitiveType: 'LivingObject';
  properties: EDLProperty[];
  relationships: EDLRelationshipDef[];
  lifecycle: {
    states: EDLLifecycleState[];
    transitions: EDLLifecycleTransition[];
    initialState: string;
  };
  eventsProduced: string[];    // Array of event names this object can emit
}

export interface EDLActor extends EDLLivingObject {
  primitiveType: 'Actor';
  canAuthenticate: boolean;
}

export interface EDLProcess extends EDLPrimitive {
  primitiveType: 'Process';
  // V0.1 focuses on state machines; complex DAG execution definitions will extend this.
  executionType: 'state_machine' | 'workflow_dag' | 'automation';
  definitionPayload: any;      // The actual executable schema (e.g. state machine JSON)
}

export interface EDLPolicy extends EDLPrimitive {
  primitiveType: 'Policy';
  ruleExpression: string;      // The logic (e.g. `amount > 5000 AND requires_vp`)
  errorMessage: string;        // Human readable error if policy fails
}

export interface EDLGoal extends EDLPrimitive {
  primitiveType: 'Goal';
  targetMetric?: string;       // The metric being measured
  targetValue?: number;
  timeframe: {
    start: Date | string;
    end: Date | string;
  };
}

export interface EDLKnowledge extends EDLPrimitive {
  primitiveType: 'Knowledge';
  contentUrl?: string;         // e.g., S3 URL
  contentRaw?: string;         // Inline markdown
  confidenceScore: number;     // 0.0 to 1.0
}
