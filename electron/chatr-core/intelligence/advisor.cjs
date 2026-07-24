/**
 * Self-Healing Advisor (Advise Domain)
 * Detects failures and suggests improvements.
 * Produces an immutable Recommendation artifact. DOES NOT auto-apply.
 */

class SelfHealingAdvisor {
    /**
     * Consumes an Execution Outcome (failure) and recommends a remediation path.
     */
    analyzeFailure(executionOutcome) {
        console.log(`[SelfHealingAdvisor] Analyzing Failure for Outcome: ${executionOutcome.id}`);

        if (executionOutcome.status !== 'FAILED') {
            return null; // Nothing to heal
        }

        const failedProvider = executionOutcome.errorDetails?.provider;
        let recommendationAction = null;
        let reasoning = "Unknown failure pattern.";
        let predictionConfidence = 0.5;

        // Mock heuristic pattern detection
        if (failedProvider === 'provider_stripe' && executionOutcome.errorDetails.code === 'RATE_LIMIT_EXCEEDED') {
            recommendationAction = {
                action: "SWITCH_PROVIDER",
                targetCapability: "payment.process",
                suggestedProvider: "provider_paypal"
            };
            reasoning = "Provider 'provider_stripe' is consistently hitting rate limits. Switching to fallback provider 'provider_paypal' is recommended to restore SLA.";
            predictionConfidence = 0.93;
        }

        if (!recommendationAction) {
            console.log(`[SelfHealingAdvisor] No clear remediation path found.`);
            return null;
        }

        const recommendation = {
            id: `rec_heal_${Date.now()}`,
            type: "Recommendation",
            category: "SelfHealing",
            recommendedAction: recommendationAction,
            explainability: {
                reasoning,
                expectedImpact: "Restores execution success rate by bypassing degraded provider.",
                evidence: [executionOutcome.id],
                generatedBy: "IntelligencePlane:SelfHealingAdvisor:v1",
                timestamp: new Date().toISOString(),
                governance: {
                    sourceModel: "HeuristicFailoverRuleset",
                    version: "1.2",
                    trainingWindow: "N/A",
                    generationMethod: "Rule-based pattern matching",
                    reproducibility: "Deterministic"
                }
            },
            confidence: {
                predictionConfidence: predictionConfidence,
                evidenceQuality: "High", // Hard failure in telemetry is strong evidence
                modelConfidence: "High"  // Rule-based is highly confident
            }
        };

        console.log(`[SelfHealingAdvisor] Generated Self-Healing Recommendation: ${recommendation.id} (Action: ${recommendationAction.action})`);
        return recommendation;
    }
}

module.exports = new SelfHealingAdvisor();
