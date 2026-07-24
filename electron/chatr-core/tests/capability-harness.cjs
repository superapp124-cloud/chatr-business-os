'use strict';

/**
 * Capability Test Harness
 * 
 * Verifies that the Kernel, Event Router, and Capability Modules produce 
 * deterministic state projections without requiring a UI.
 */
const { bus } = require('../events/bus.cjs');
const { senseModule } = require('../modules/sense/service.cjs');
require('../modules/meetings/index.cjs');
require('../modules/tasks/index.cjs');
require('../modules/documents/index.cjs');
require('../modules/contacts/index.cjs');
const crypto = require('crypto');

async function runDemo() {
  console.log('--- STARTING CROSS-CAPABILITY DEMO HARNESS ---\n');
  const conversationId = crypto.randomUUID();

  // Step 1: Meet John tomorrow
  console.log('🗣 Input 1: "Meet John tomorrow"');
  await emitInput('Meet John tomorrow', conversationId);
  await sleep(100);

  // Step 2: Create a task from that
  console.log('\n🗣 Input 2: "Create a task from that"');
  await emitInput('Create a task from that', conversationId);
  await sleep(100);

  // Step 3: Attach the proposal
  console.log('\n🗣 Input 3: "Attach the proposal"');
  await emitInput('Attach the proposal', conversationId);
  await sleep(100);

  // Step 4: Remind me after the meeting
  console.log('\n🗣 Input 4: "Remind me after the meeting"');
  await emitInput('Remind me after the meeting', conversationId);
  await sleep(100);

  console.log('\n--- DEMO COMPLETE ---');
  process.exit(0);
}

// Intercept ACTION.REVEALED to simulate the user clicking "Confirm"
bus.subscribe('KERNEL.ACTION.REVEALED', (envelope) => {
  console.log(`\n  ✅ PROJECTION READY: [${envelope.capability}] revealed action:`, envelope.payload.action.type);
  
  if (envelope.payload.action.entities) {
    if (envelope.payload.action.entities.people) console.log(`     -> Contacts resolved:`, envelope.payload.action.entities.people.map(p => p.name || p));
    if (envelope.payload.action.entities.documents) console.log(`     -> Documents resolved:`, envelope.payload.action.entities.documents.map(d => d.title));
  }
  if (envelope.payload.action.contextRef) {
    console.log(`     -> Linked Context:`, envelope.payload.action.contextRef);
  }

  // Simulate User Confirmation
  setTimeout(() => {
    console.log(`  👉 USER CONFIRMS: ${envelope.payload.action.type}`);
    bus.publish('KERNEL.ACTION.CONFIRMED', {
      conversationId: envelope.payload.conversationId,
      action: envelope.payload.action,
      capability: envelope.capability,
      correlationId: envelope.correlationId
    });
  }, 50);
});

bus.subscribe('KERNEL.ACTION.EXECUTED', (envelope) => {
  console.log(`  ⚡ EXECUTED: ${envelope.payload.action.type} -> ${envelope.payload.status}`);
});

bus.subscribe('KERNEL.CONTEXT.RESOLVED', (envelope) => {
  console.log(`  🔗 CONTEXT INHERITED: ${envelope.payload.id} (Score: ${envelope.payload.score})`);
});

async function emitInput(text, conversationId) {
  const requestId = crypto.randomUUID();
  await senseModule.observe({ messageText: text, conversationId, requestId, workspaceId: 'default' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start
runDemo();
