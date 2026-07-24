'use strict';

/**
 * CHATR Intent OS — Experience Track Prototype
 * Journey: "Order a Chicken Biryani"
 * 
 * Validates that the frozen kernel pipeline smoothly drives an end-to-end
 * user intent to completion using mocked execution.
 */

const { GoalRuntime, GoalStatus } = require('../electron/chatr-core/kernel/goal-runtime.cjs');
const { WorkflowGenerator } = require('../electron/chatr-core/kernel/workflow-generator.cjs');
const { Scheduler } = require('../electron/chatr-core/kernel/scheduler.cjs');
const { ObserverLoop } = require('../electron/chatr-core/kernel/observer-loop.cjs');
const { KernelTrace } = require('../electron/chatr-core/kernel/kernel-trace.cjs');
const { ReconciliationEngine } = require('../electron/chatr-core/kernel/reconciliation-engine.cjs');
const { VerificationEngine } = require('../electron/chatr-core/kernel/verification-engine.cjs');
const { Bus } = require('../electron/chatr-core/events/bus.cjs'); // assuming simple bus

// Minimal event bus for simulation
class MockBus {
  constructor() { this.listeners = {}; }
  on(evt, cb) { if (!this.listeners[evt]) this.listeners[evt] = []; this.listeners[evt].push(cb); }
  publish(evt, payload) { if (this.listeners[evt]) this.listeners[evt].forEach(cb => cb(payload)); }
}

async function runBiryaniPrototype() {
  console.log('=== Experience Track: Order a Chicken Biryani ===\n');

  // Boot Kernel Services
  const bus = new MockBus();
  const trace = new KernelTrace(bus);
  const runtime = new GoalRuntime({ bus });
  const workflowGen = new WorkflowGenerator();
  const scheduler = new Scheduler();
  const observer = new ObserverLoop({ bus });
  const recon = new ReconciliationEngine();
  const verification = new VerificationEngine();

  // Register Mock Browser & API Adapters
  observer.registerAdapter('browser', (raw) => ({
    goal_id: raw.gId,
    workflow_step: raw.step,
    observation_type: 'dom',
    payload: { status: raw.content },
    metadata: { mock_source: 'Zomato Simulator' }
  }));

  observer.registerAdapter('webhook', (raw) => ({
    goal_id: raw.gId,
    workflow_step: raw.step,
    observation_type: 'webhook',
    payload: { state: raw.state, orderId: raw.orderId },
    metadata: { mock_source: 'Payment Gateway' }
  }));

  // 1. Goal Created from Intent
  const GOAL_ID = 'goal_biryani_123';
  console.log('[1] User Intent: "Order a chicken biryani"');
  runtime.createGoal(GOAL_ID, 'intent_order_food');

  // 2. Resolution Layer output (Simulated ProviderSelection & GoalPlan)
  const goalPlan = { goal_id: GOAL_ID, capabilities: ['DISCOVER', 'PAY'] };
  const providerSelection = { 
    provider_id: 'zomato', 
    capabilities: ['DISCOVER', 'PAY'], 
    execution_mode: 'ExecutionMode.BROWSER', 
    requires_authentication: true 
  };
  const expectedOutcomes = ['order_confirmed', 'payment_confirmed'];

  // 3. Workflow Generation (D3)
  const graph = workflowGen.compile(goalPlan, providerSelection);
  console.log(`[2] Workflow Generated (Hash: ${graph.deterministic_hash})`);
  runtime.process({ abi: 'chatr.workflow_graph.v0_9_rc', goal_id: GOAL_ID, sequence: 1, producer: 'workflow-generator', ...graph });

  // 4. Scheduling (D4)
  console.log(`[3] Requesting Execution Slots`);
  scheduler.requestSlot(GOAL_ID, graph.nodes[0].node_id, 'lease_1', 100);
  const slot = scheduler.allocateNext(new Set(['lease_1']));
  if (slot) {
    runtime.process({ abi: 'chatr.scheduler_allocation.v0_9_rc', goal_id: GOAL_ID, sequence: 2 });
  }

  // 5. Mock Execution & Observation (D5, D6, D7)
  console.log(`[4] Simulating Browser Execution (Zomato) with injected failure`);
  
  let goalSeq = 3;
  const accumulatedEvidence = [];
  
  bus.on('kernel.observation.created', (frame) => {
    console.log(`[Observer] Emitted frame ${frame.observation_id} for step ${frame.workflow_step} (Source: ${frame.observation_type})`);
    accumulatedEvidence.push(frame);
    
    // Process Observation in GoalRuntime
    runtime.process({ 
      abi: 'chatr.observation_frame.v0_9_rc', 
      goal_id: GOAL_ID, 
      sequence: goalSeq++, 
      observation_id: frame.observation_id,
      producer: 'observer-loop'
    });

    const currentGoal = runtime.getGoal(GOAL_ID);

    // Run Reconciliation (D6)
    const proposal = recon.reconcile(currentGoal, graph, frame);
    if (proposal) {
      console.log(`[Reconciliation] Drift Detected! Emitting RecoveryProposal: ${proposal.proposal_type}`);
      runtime.process({
        ...proposal,
        sequence: goalSeq++,
        producer: 'reconciliation-engine'
      });
    }

    // Run Verification (D7)
    const vResult = verification.verify(currentGoal, expectedOutcomes, accumulatedEvidence);
    if (vResult) {
      console.log(`[Verification] Intent Fulfilled! Status: ${vResult.result} | Confidence: ${vResult.confidence}`);
      runtime.process({
        ...vResult,
        sequence: goalSeq++,
        producer: 'verification-engine'
      });
    }
  });

  // Simulate DOM changing (Injected Failure)
  observer.ingest('browser', { gId: GOAL_ID, step: 'AUTHENTICATE', content: 'Login Expired' });
  await observer._drainQueue();

  console.log(`[5] Recovery Scheduled. Simulating retry...`);
  // Successful retry
  observer.ingest('browser', { gId: GOAL_ID, step: 'AUTHENTICATE', content: 'Logged in as Arshid' });
  observer.ingest('browser', { gId: GOAL_ID, step: 'DISCOVER', content: 'Order Confirmed: Paradise Biryani' });
  observer.ingest('browser', { gId: GOAL_ID, step: 'PAY', content: 'Payment complete via UPI' });
  await observer._drainQueue();

  console.log(`[6] Injecting external webhook evidence...`);
  // Webhook for Multi-Evidence Verification
  observer.ingest('webhook', { gId: GOAL_ID, step: 'PAY', state: 'payment_confirmed', orderId: 'Z-1234' });
  await observer._drainQueue();

  // 7. Output Trace
  console.log('\n=== Kernel Trace Output ===');
  console.log(trace.getTrace(GOAL_ID));
  console.log('\nPrototype run complete.');
}

runBiryaniPrototype().catch(console.error);
