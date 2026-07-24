const crypto = require('crypto');
const GraphValidator = require('./graph-validator.cjs');
const { CapabilityRegistry } = require('../capabilities/registry.cjs');

class Planner {
    constructor() {
        this.version = "1.0.0";
    }

    compile(irDocument) {
        console.log(`[Planner] Starting compilation of IR Document: ${irDocument.metadata?.id}`);
        const report = {
            id: crypto.randomUUID(),
            plan_id: null,
            warnings: [],
            optimization_decisions: [],
            resolved_capabilities: [],
            unresolved_references: [],
            estimated_complexity: 0,
            compilation_time_ms: 0,
            timestamp: new Date().toISOString()
        };
        const startTime = Date.now();
        let plan = null;

        try {
            // PASS-100: Normalize
            console.log(`[PASS-100] Normalize`);
            const normalizedIR = this._pass100_normalize(irDocument);

            // PASS-200: Structural Validation
            console.log(`[PASS-200] Structural Validation`);
            this._pass200_validate(normalizedIR);

            // PASS-300: Semantic Resolution
            console.log(`[PASS-300] Semantic Resolution`);
            const semanticContext = this._pass300_resolve(normalizedIR, report);

            // PASS-400: Dependency Analysis
            console.log(`[PASS-400] Dependency Analysis`);
            const depGraph = this._pass400_analyzeDependencies(normalizedIR);

            // PASS-500: Optimization
            console.log(`[PASS-500] Optimization`);
            const optimizedGraph = this._pass500_optimize(normalizedIR, depGraph, report);

            // PASS-600: Execution Validation
            console.log(`[PASS-600] Execution Validation`);
            this._pass600_validateExecution(optimizedGraph, semanticContext, report);

            // PASS-700: Artifact Generation
            console.log(`[PASS-700] Artifact Generation`);
            plan = this._pass700_generate(optimizedGraph, semanticContext, depGraph);

            report.plan_id = plan.id;
        } catch (error) {
            console.error(`[Planner] Compilation failed: ${error.message}`);
            report.warnings.push(`Compilation failed: ${error.message}`);
            throw error;
        } finally {
            report.compilation_time_ms = Date.now() - startTime;
            report.estimated_complexity = irDocument.blocks ? irDocument.blocks.length : 0;
        }

        return { plan, report };
    }

    _pass100_normalize(ir) {
        // Ensure arrays exist
        ir.blocks = ir.blocks || [];
        ir.variables = ir.variables || [];
        return ir;
    }

    _pass200_validate(ir) {
        const validation = GraphValidator.validate(ir);
        if (!validation.valid) {
            throw new Error(`Structural Validation Failed: \n - ${validation.errors.join('\n - ')}`);
        }
    }

    _pass300_resolve(ir, report) {
        const context = { capabilities: {} };
        for (const block of ir.blocks) {
            if (block.type === 'Intent') {
                if (!block.capability) {
                    report.unresolved_references.push({ blockId: block.id, reason: 'Missing capability declaration' });
                    continue;
                }
                // Try resolving capability against ABI version 1.0 (hardcoded for now)
                const capabilities = CapabilityRegistry.findCapabilitiesForIntent(block.capability, "1.0");
                if (capabilities.length === 0) {
                    report.unresolved_references.push({ blockId: block.id, reason: `Capability not found: ${block.capability}` });
                } else {
                    // Pick the highest version or default
                    context.capabilities[block.id] = capabilities[0];
                    report.resolved_capabilities.push(block.capability);
                }
            }
        }
        return context;
    }

    _pass400_analyzeDependencies(ir) {
        const deps = {};
        for (const block of ir.blocks) {
            deps[block.id] = block.dependencies || [];
        }
        return deps;
    }

    _pass500_optimize(ir, depGraph, report) {
        // Optimization: Collapse redundant waits (Mock implementation)
        const optimizedBlocks = [];
        let waitsCollapsed = 0;
        let lastWasWait = false;
        
        for (const block of ir.blocks) {
            if (block.type === 'Wait') {
                if (lastWasWait) {
                    waitsCollapsed++;
                    continue; // Skip this block
                }
                lastWasWait = true;
            } else {
                lastWasWait = false;
            }
            optimizedBlocks.push(block);
        }

        if (waitsCollapsed > 0) {
            report.optimization_decisions.push({
                optimization: 'Collapsed sequential duplicate waits',
                reason: 'Equivalent wait conditions',
                rule: 'OPT-001'
            });
        }
        
        ir.blocks = optimizedBlocks;
        return ir;
    }

    _pass600_validateExecution(ir, context, report) {
        if (report.unresolved_references.length > 0) {
            throw new Error(`Execution Validation Failed: Unresolved references exist.`);
        }
    }

    _pass700_generate(ir, context, depGraph) {
        return {
            id: crypto.randomUUID(),
            graph_version: ir.irVersion || "1.0",
            planner_version: this.version,
            capabilities: context.capabilities,
            dependencies: depGraph,
            parallel_groups: [],
            estimated_cost: 0,
            estimated_duration: 0,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = Planner;
