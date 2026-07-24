/**
 * Experiment Service (Predict Domain)
 * Enables safe A/B analysis of execution plans using the Simulator.
 * Produces an immutable Recommendation artifact based on the comparison.
 */

const SimulationEngine = require('./simulator.cjs');

class ExperimentService {
    /**
     * Safely evaluates a proposed Execution Plan against a baseline Execution Plan.
     */
    evaluateAlternative(baselinePlan, proposedPlan) {
        console.log(`[ExperimentService] Starting A/B Evaluation. Baseline: ${baselinePlan.id}, Proposed: ${proposedPlan.id}`);
        
        const baselineReport = SimulationEngine.simulate(baselinePlan);
        const proposedReport = SimulationEngine.simulate(proposedPlan);

        const costDiff = baselineReport.metrics.estimatedCostUSD - proposedReport.metrics.estimatedCostUSD;
        const latencyDiff = baselineReport.metrics.estimatedLatencyMs - proposedReport.metrics.estimatedLatencyMs;

        let recommendationAction = null;
        let reasoning = "";
        let expectedImpact = "";

        if (costDiff > 0 || latencyDiff > 0) {
            // Proposed is better
            recommendationAction = { action: "REPLACE_PLAN", targetId: baselinePlan.id, replacementId: proposedPlan.id };
            reasoning = `Proposed plan improves performance. Cost delta: $${costDiff.toFixed(2)}, Latency delta: ${latencyDiff}ms.`;
            expectedImpact = `Cost reduction of $${Math.max(0, costDiff).toFixed(2)} and latency reduction of ${Math.max(0, latencyDiff)}ms per execution.`;
        } else {
            // Baseline is better or equal
            recommendationAction = { action: "RETAIN_BASELINE", targetId: baselinePlan.id };
            reasoning = `Proposed plan offers no improvement over baseline.`;
            expectedImpact = "No change required. Stability maintained.";
        }

        const recommendation = {
            id: `rec_exp_${Date.now()}`,
            type: "Recommendation",
            category: "ExecutionOptimization",
            recommendedAction: recommendationAction,
            explainability: {
                reasoning,
                expectedImpact,
                evidence: [baselineReport.id, proposedReport.id],
                generatedBy: "IntelligencePlane:ExperimentService:v1",
                timestamp: new Date().toISOString(),
                governance: {
                    sourceModel: "DeterministicComparator",
                    version: "1.0",
                    trainingWindow: "N/A",
                    generationMethod: "A/B Simulation Comparison",
                    reproducibility: "Deterministic"
                }
            },
            confidence: {
                predictionConfidence: 0.95, // High because it's deterministic simulation
                evidenceQuality: "High",
                modelConfidence: "High"
            }
        };

        console.log(`[ExperimentService] Evaluation complete. Generated Recommendation: ${recommendation.id}`);
        return recommendation;
    }
}

module.exports = new ExperimentService();
