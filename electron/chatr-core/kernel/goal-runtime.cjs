'use strict';

/**
 * CHATR Kernel — Goal Runtime (v0.9 RC)
 * 
 * Goal Runtime is a Pure State Machine.
 * It is the single source of truth for execution progress.
 * It never executes, plans, or schedules. It only validates ABI objects,
 * applies legal state transitions, persists state, and emits events.
 * 
 * Constraints:
 * 1. Event-Sourced Transitions Only
 * 2. Idempotent processing (based on sequence/correlation)
 * 3. Strict Transition Table Enforcement
 * 4. Out-of-order delivery tolerance (via sequence numbers)
 */

const crypto = require('crypto');
const { GOAL } = require('../events/events.cjs');

const ABI = 'chatr.goal_runtime_state.v0_9_rc';
const STATE_COLLECTION = 'kernel_goal_runtime_state_v0_9_rc';

// Canonical States
const GoalStatus = Object.freeze({
  CREATED: 'CREATED',
  PLANNED: 'PLANNED',
  READY: 'READY',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  RECOVERING: 'RECOVERING',
  VERIFYING: 'VERIFYING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

const TERMINAL_STATUSES = new Set([
  GoalStatus.COMPLETED,
  GoalStatus.FAILED,
  GoalStatus.CANCELLED
]);

// State Transition Table
// Maps: CurrentState -> InputType -> NextState
const TRANSITIONS = {
  [GoalStatus.CREATED]: {
    'chatr.workflow_graph.v0_9_rc': GoalStatus.READY, // Or PLANNED, but user example used READY
  },
  [GoalStatus.READY]: {
    'chatr.scheduler_allocation.v0_9_rc': GoalStatus.RUNNING,
  },
  [GoalStatus.RUNNING]: {
    'chatr.observation_frame.v0_9_rc': GoalStatus.RUNNING,
    'chatr.recovery_proposal.v0_9_rc': GoalStatus.RECOVERING,
    'chatr.verification_result.v0_9_rc': (input) => input.result === 'verified' ? GoalStatus.COMPLETED : GoalStatus.FAILED,
  },
  [GoalStatus.RECOVERING]: {
    'chatr.observation_frame.v0_9_rc': GoalStatus.RUNNING,
    'chatr.workflow_graph.v0_9_rc': GoalStatus.READY,
  },
  [GoalStatus.WAITING]: {
    'chatr.observation_frame.v0_9_rc': GoalStatus.RUNNING,
  },
  [GoalStatus.VERIFYING]: {
    'chatr.verification_result.v0_9_rc': (input) => input.result === 'verified' ? GoalStatus.COMPLETED : GoalStatus.FAILED,
  }
};

class GoalRuntime {
  constructor(options = {}) {
    this.persistence = options.persistence || this._createFallbackPersistence();
    this.bus = options.bus || { publish: () => {} };
    this.now = options.now || (() => new Date().toISOString());
    this.goals = new Map();
    this.processedSequences = new Map(); // goal_id -> max_sequence
    this.loadFromDisk();
  }

  _createFallbackPersistence() {
    return {
      store: () => true,
      retrieve: () => null,
      query: () => []
    };
  }

  loadFromDisk() {
    try {
      const records = this.persistence.query ? this.persistence.query(STATE_COLLECTION, {}) : [];
      if (Array.isArray(records)) {
        for (const record of records) {
          if (record && record.goal_id) {
            this.goals.set(record.goal_id, record);
            this.processedSequences.set(record.goal_id, record.last_sequence || 0);
          }
        }
      }
    } catch (err) {
      // Ignore if collection doesn't exist
    }
  }

  persist(goalState) {
    if (this.persistence && this.persistence.store) {
      this.persistence.store(STATE_COLLECTION, { id: goalState.goal_id, ...goalState });
    }
  }

  createGoal(goalId, intentRef) {
    if (this.goals.has(goalId)) {
      throw new Error(`Goal already exists: ${goalId}`);
    }

    const state = {
      abi: ABI,
      goal_id: goalId,
      status: GoalStatus.CREATED,
      intent_ref: intentRef,
      last_sequence: 0,
      created_at: this.now(),
      updated_at: this.now(),
      history: []
    };

    this.goals.set(goalId, state);
    this.processedSequences.set(goalId, 0);
    this.persist(state);
    
    if (this.bus && this.bus.publish) {
      this.bus.publish('kernel.goal.created', state);
    }
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Process an incoming ABI object to drive the State Machine.
   * Ensures idempotency, sequence ordering, and valid transitions.
   */
  process(abiObject) {
    if (!abiObject || !abiObject.abi || !abiObject.goal_id) {
      throw new Error('Invalid input: Must be a CHATR ABI object with a goal_id');
    }

    const { goal_id, abi, sequence, producer, correlation_id } = abiObject;
    const currentGoal = this.goals.get(goal_id);

    if (!currentGoal) {
      throw new Error(`Unknown goal: ${goal_id}`);
    }

    if (TERMINAL_STATUSES.has(currentGoal.status)) {
      throw new Error(`Goal ${goal_id} is already terminal (${currentGoal.status})`);
    }

    // --- Idempotency & Sequence Check ---
    if (sequence !== undefined) {
      const currentSeq = this.processedSequences.get(goal_id) || 0;
      if (sequence <= currentSeq) {
        // Out-of-order or duplicate!
        // We either buffer it, or just drop it if it's strictly older.
        // For Milestone D idempotency, we return early.
        return JSON.parse(JSON.stringify(currentGoal)); 
      }
    }

    // --- State Transition Logic ---
    const allowedInputs = TRANSITIONS[currentGoal.status];
    if (!allowedInputs) {
      throw new Error(`No transitions defined for state ${currentGoal.status}`);
    }

    const nextStateResolver = allowedInputs[abi];
    if (!nextStateResolver) {
      throw new Error(`Illegal transition: Cannot process ${abi} from state ${currentGoal.status}`);
    }

    const nextState = typeof nextStateResolver === 'function' ? nextStateResolver(abiObject) : nextStateResolver;

    if (!nextState || !GoalStatus[nextState]) {
       throw new Error(`Resolved invalid state: ${nextState}`);
    }

    // --- Apply Mutation ---
    const timestamp = this.now();
    const updatedGoal = {
      ...currentGoal,
      status: nextState,
      updated_at: timestamp,
      last_sequence: sequence !== undefined ? sequence : currentGoal.last_sequence,
      history: [
        ...currentGoal.history,
        {
          status: nextState,
          at: timestamp,
          trigger: abi,
          producer: producer || 'unknown',
          correlation_id: correlation_id || null
        }
      ]
    };

    // Specific object bindings
    if (abi === 'chatr.workflow_graph.v0_9_rc') {
      updatedGoal.active_workflow = abiObject;
    } else if (abi === 'chatr.observation_frame.v0_9_rc') {
      updatedGoal.last_observation = abiObject;
    } else if (abi === 'chatr.recovery_proposal.v0_9_rc') {
      updatedGoal.active_recovery_proposal = abiObject;
    } else if (abi === 'chatr.verification_result.v0_9_rc') {
      updatedGoal.verification_evidence = abiObject;
    }
    
    if (sequence !== undefined) {
      this.processedSequences.set(goal_id, sequence);
    }

    this.goals.set(goal_id, updatedGoal);
    this.persist(updatedGoal);

    if (this.bus && this.bus.publish) {
      this.bus.publish('kernel.goal.transitioned', updatedGoal);
      if (TERMINAL_STATUSES.has(nextState)) {
        this.bus.publish('kernel.goal.terminal', updatedGoal);
      }
    }

    return JSON.parse(JSON.stringify(updatedGoal));
  }

  getGoal(goalId) {
    const goal = this.goals.get(goalId);
    return goal ? JSON.parse(JSON.stringify(goal)) : null;
  }

  recoverActiveGoals() {
    const active = [];
    for (const [id, goal] of this.goals.entries()) {
      if (!TERMINAL_STATUSES.has(goal.status)) {
        active.push(goal);
      }
    }
    return active;
  }
}

let _instance = null;
function getGoalRuntime() {
  if (!_instance) {
    _instance = new GoalRuntime();
  }
  return _instance;
}

module.exports = {
  GoalRuntime,
  GoalStatus,
  getGoalRuntime
};
