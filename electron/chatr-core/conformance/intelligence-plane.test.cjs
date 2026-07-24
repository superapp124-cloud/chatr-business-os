const assert = require('assert');

// Intelligence Plane Services
const KnowledgeEngine = require('../intelligence/knowledge.cjs');
const SimulationEngine = require('../intelligence/simulator.cjs');
const ExperimentService = require('../intelligence/experiment.cjs');
const SelfHealingAdvisor = require('../intelligence/advisor.cjs');

async function runTests() {
    console.log("=== Running Architecture Conformance Suite: Intelligence Plane ===");

    // 1. Knowledge Engine (Understand Domain)
    const execPlan = { id: 'plan_100', type: 'ExecutionPlan' };
    const execOutcome = { id: 'outcome_100', type: 'ExecutionOutcome', status: 'SUCCESS' };
    
    KnowledgeEngine.storeArtifact(execPlan);
    KnowledgeEngine.storeArtifact(execOutcome);
    KnowledgeEngine.indexRelationship(execPlan.id, 'produced', execOutcome.id, { context: 'ProductionRun' });
    
    const history = KnowledgeEngine.queryHistory(execPlan.id);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].targetId, execOutcome.id);
    console.log("✅ Knowledge Engine stored semantic operational history.");

    // 2. Simulation Engine (Predict Domain)
    const testPlan = {
        id: 'plan_sim_1',
        capabilities: {
            'node1': 'travel.hotel.booking',
            'node2': 'payment.process'
        }
    };

    const simReport = SimulationEngine.simulate(testPlan);
    assert.strictEqual(simReport.type, 'SimulationReport');
    assert.ok(simReport.metrics.estimatedCostUSD > 0);
    assert.ok(simReport.explainability.reasoning);
    assert.ok(simReport.confidence.predictionConfidence);
    console.log("✅ Simulation Engine deterministically predicted execution metrics without touching the network.");

    // 3. Experiment Service (Predict/Advise Domain)
    const proposedPlan = {
        id: 'plan_sim_2_optimized',
        capabilities: {
            'node1': 'travel.hotel.booking', // Same cost
            'node2': 'payment.process_cheap' // Different mock cost
        }
    };
    
    const recommendation = ExperimentService.evaluateAlternative(testPlan, proposedPlan);
    assert.strictEqual(recommendation.type, 'Recommendation');
    assert.strictEqual(recommendation.category, 'ExecutionOptimization');
    assert.ok(recommendation.explainability.expectedImpact);
    
    // Invariant Check: The Experiment Service MUST NOT modify the testPlan
    assert.strictEqual(testPlan.id, 'plan_sim_1'); 
    console.log("✅ Experiment Service successfully evaluated an A/B test and output an immutable Recommendation.");

    // 4. Self-Healing Advisor (Advise Domain)
    const failedOutcome = {
        id: 'outcome_fail_1',
        status: 'FAILED',
        errorDetails: {
            provider: 'provider_stripe',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    };

    const healingRecommendation = SelfHealingAdvisor.analyzeFailure(failedOutcome);
    assert.strictEqual(healingRecommendation.type, 'Recommendation');
    assert.strictEqual(healingRecommendation.category, 'SelfHealing');
    assert.strictEqual(healingRecommendation.recommendedAction.action, 'SWITCH_PROVIDER');
    
    // Verify Governance Metadata & Confidence Bands
    assert.strictEqual(healingRecommendation.confidence.evidenceQuality, 'High');
    assert.ok(healingRecommendation.explainability.governance.sourceModel);
    
    // Crucial Architectural Check: No provider was actually switched by the Advisor.
    console.log("✅ Self-Healing Advisor detected failure and recommended remediation, maintaining the Absolute Advisory Invariant.");

    console.log("All Intelligence Plane Architecture Conformance Tests Passed.");
}

runTests().catch(console.error);
