const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadSchema(filename) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../schema/runtime', filename), 'utf8'));
}

async function runBusinessRuntimeConformance() {
    console.log("=== Running Architecture Conformance Suite: Business Runtime ===");

    const capabilitiesSchema = loadSchema('capabilities.schema.json');
    const actionsSchema = loadSchema('actions.schema.json');
    const outcomesSchema = loadSchema('outcomes.schema.json');
    const uxSchema = loadSchema('semantic-ux.schema.json');
    const workflowsSchema = loadSchema('workflows.schema.json');
    const journeysSchema = loadSchema('journeys.schema.json');
    const intelligenceSchema = loadSchema('intelligence-contract.schema.json');

    // Test 1: Capability must define Business Actions (Law 3 of Capability Constitution)
    const capDef = capabilitiesSchema.definitions.Capability;
    const execution = capDef.properties.execution;
    assert.ok(execution.properties.businessActions, "Capability schema must contain businessActions array");
    const actionsRef = execution.properties.businessActions.items.$ref;
    assert.ok(actionsRef.includes('actions.schema.json'), "Business actions must reference the discrete BusinessAction schema");
    console.log("✅ Conformance Pass: Capabilities correctly decompose into discrete Business Actions (Law 3).");

    // Test 2: Capability must define Business Outcomes (Law 6 of Capability Constitution)
    const runtime = capDef.properties.runtime;
    assert.ok(runtime.properties.businessOutcomes, "Capability schema must mandate formal Business Outcomes");
    console.log("✅ Conformance Pass: Execution correctly terminates in formalized Business Outcomes (Law 6).");

    // Test 3: Capability must be Idempotent-aware (Law 5)
    assert.ok(runtime.properties.isIdempotent !== undefined, "Capabilities must declare idempotency.");
    console.log("✅ Conformance Pass: Capabilities declare Idempotency (Law 5).");

    // Test 4: Capability must implement Intelligence Hooks (Law 12)
    const intelligence = capDef.properties.intelligence;
    assert.ok(intelligence.properties.optimizationSignals, "Capabilities must expose Optimization Signals");
    assert.ok(intelligence.properties.learningOutputs, "Capabilities must expose Learning Outputs");
    console.log("✅ Conformance Pass: Capabilities expose Standard Intelligence Hooks (Law 12).");

    // Test 5: Capability must define Compensation Strategy (Law 9)
    assert.ok(runtime.properties.compensationStrategy, "Capabilities must declare a Compensation Strategy");
    console.log("✅ Conformance Pass: Capabilities define Compensation & Rollback strategies (Law 9).");

    // Test 6: Journeys must encompass full lifecycle and define failure scenarios
    const journeyDef = journeysSchema.definitions.BusinessJourney;
    assert.ok(journeyDef.properties.failureScenarios, "Business Journeys must specify failure scenarios and recovery strategies");
    assert.ok(journeyDef.properties.businessMetrics, "Business Journeys must track Business Metrics");
    console.log("✅ Conformance Pass: Business Journeys encompass failure scenarios and KPIs.");

    console.log("All Business Runtime Architecture Conformance Tests Passed.");
}

runBusinessRuntimeConformance().catch(console.error);
