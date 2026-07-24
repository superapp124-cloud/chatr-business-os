const assert = require('assert');
const Planner = require('../orchestration/planner.cjs');
const PlanValidator = require('../orchestration/plan-validator.cjs');

async function runTests() {
    console.log("=== Running Intent Composer & Planner Conformance Tests ===");
    
    // 1. Mock the Intent Graph (The visual output from Intent Studio)
    const rawGraph = {
        name: "Travel Booking Template",
        nodes: [
            { id: "node1", type: "business", action: "search_hotels" },
            { id: "node2", type: "business", action: "book_hotel" }
        ],
        edges: [
            { from: "node1", to: "node2" }
        ]
    };

    // 2. Mock the Normalized Intent IR (What the Planner actually consumes)
    const mockIR = {
        irVersion: "1.0",
        metadata: {
            authoringSource: "intent_studio",
            timestamp: new Date().toISOString(),
            id: "ir-1234"
        },
        variables: [
            { name: "destination", type: "String", scope: "global", source: "input" },
            { name: "hotelReservation", type: "Composite", domainType: "travel.Reservation", scope: "global", source: "internal" }
        ],
        blocks: [
            {
                id: "b1",
                type: "Intent",
                capability: "travel.hotel.booking",
                dependencies: []
            },
            {
                id: "b2",
                type: "Wait",
                dependencies: ["b1"]
            },
            {
                id: "b3",
                type: "Wait", // Will be collapsed by optimization pass
                dependencies: ["b2"]
            }
        ]
    };

    // 3. Run the Planner (7-Pass Compiler)
    const planner = new Planner();
    const { plan, report } = planner.compile(mockIR);

    // Assertions on Planner Output
    assert.ok(plan, "ExecutionPlan should be generated");
    assert.strictEqual(plan.graph_version, "1.0");
    assert.ok(plan.capabilities['b1'], "Capability for b1 should be resolved");
    
    assert.ok(report, "PlannerReport should be generated");
    assert.strictEqual(report.optimization_decisions.length, 1, "Should have 1 optimization decision (collapsed wait)");
    console.log("✅ Planner successfully compiled Intent IR to Execution Plan & Planner Report");

    // 4. Run the Plan Validator (Certification Pipeline)
    const cert = PlanValidator.validate(plan, mockIR, rawGraph);

    // Assertions on Certification
    assert.ok(cert, "CompilationCertificate should be generated");
    assert.strictEqual(cert.validation_status, "CERTIFIED");
    assert.ok(cert.execution_plan_hash, "Hash should be generated");
    console.log("✅ PlanValidator successfully certified the Execution Plan");

    console.log("All Intent Composer Conformance Tests Passed.");
}

runTests().catch(console.error);
