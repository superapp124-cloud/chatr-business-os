/**
 * PlanValidator
 * Independently certifies an Execution Plan before the Kernel executes it.
 * Generates a CompilationCertificate.
 * Explicit Invariant: NEVER mutates the Execution Plan.
 */

const crypto = require('crypto');

class PlanValidator {
    static validate(executionPlan, rawIr, rawGraph) {
        console.log(`[PlanValidator] Validating Execution Plan: ${executionPlan.id}`);
        
        // 1. Dependency validation (Acyclic check)
        if (this._hasCycle(executionPlan.dependencies)) {
            throw new Error('Plan Validation Failed: Dependency cycle detected in Execution Plan');
        }

        // 2. Capability availability check
        for (const [blockId, capability] of Object.entries(executionPlan.capabilities)) {
            if (!capability) {
                throw new Error(`Plan Validation Failed: Unresolved capability for block ${blockId}`);
            }
        }

        // Generate Hashes
        const planStr = JSON.stringify(executionPlan);
        const irStr = JSON.stringify(rawIr);
        const graphStr = JSON.stringify(rawGraph);

        const executionPlanHash = crypto.createHash('sha256').update(planStr).digest('hex');
        const irHash = crypto.createHash('sha256').update(irStr).digest('hex');
        const graphHash = crypto.createHash('sha256').update(graphStr).digest('hex');

        // Create CompilationCertificate
        const certificate = {
            id: crypto.randomUUID(),
            plan_id: executionPlan.id,
            graph_hash: graphHash,
            ir_hash: irHash,
            execution_plan_hash: executionPlanHash,
            planner_version: executionPlan.planner_version,
            validation_status: "CERTIFIED",
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Plan Certified. Compilation Certificate generated.`);
        return certificate;
    }

    static _hasCycle(dependencies) {
        // Simple mock cycle detection on the adjacency list
        const visited = new Set();
        const recursionStack = new Set();

        const dfs = (nodeId) => {
            if (recursionStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = dependencies[nodeId] || [];
            for (const neighbor of neighbors) {
                if (dfs(neighbor)) return true;
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const nodeId of Object.keys(dependencies)) {
            if (dfs(nodeId)) return true;
        }

        return false;
    }
}

module.exports = PlanValidator;
