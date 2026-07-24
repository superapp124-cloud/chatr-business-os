/**
 * GraphValidator
 * Performs Structural Validation on an Intent IR graph before Planning starts.
 * Ensures the graph can be parsed, has no missing IDs, invalid edges, cycles, 
 * duplicate variables, or broken references.
 */

class GraphValidator {
    /**
     * @param {Object} ir The Intent IR document
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    static validate(ir) {
        const errors = [];
        
        if (!ir || typeof ir !== 'object') {
            return { valid: false, errors: ['IR is not an object'] };
        }

        if (ir.irVersion !== "1.0") {
            errors.push(`Unsupported IR version: ${ir.irVersion}`);
        }

        if (!ir.blocks || !Array.isArray(ir.blocks)) {
            errors.push('Missing or invalid blocks array');
            return { valid: false, errors };
        }

        const blockIds = new Set();
        const variables = new Set();

        // 1. Variable validation
        if (ir.variables && Array.isArray(ir.variables)) {
            for (const v of ir.variables) {
                if (!v.name) {
                    errors.push('Variable missing name');
                } else if (variables.has(v.name)) {
                    errors.push(`Duplicate variable declared: ${v.name}`);
                } else {
                    variables.add(v.name);
                }
            }
        }

        // 2. Block ID collection and basic validation
        for (const block of ir.blocks) {
            if (!block.id) {
                errors.push('Block missing ID');
                continue;
            }
            if (blockIds.has(block.id)) {
                errors.push(`Duplicate block ID: ${block.id}`);
            }
            blockIds.add(block.id);
        }

        // 3. Edge validation (dependencies exist)
        const adjList = new Map();
        for (const block of ir.blocks) {
            adjList.set(block.id, []);
            if (block.dependencies && Array.isArray(block.dependencies)) {
                for (const dep of block.dependencies) {
                    if (!blockIds.has(dep)) {
                        errors.push(`Block ${block.id} references missing dependency: ${dep}`);
                    } else {
                        adjList.get(block.id).push(dep);
                    }
                }
            }
        }

        // 4. Cycle detection (DFS)
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (nodeId) => {
            if (recursionStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = adjList.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (hasCycle(neighbor)) return true;
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const blockId of blockIds) {
            if (!visited.has(blockId)) {
                if (hasCycle(blockId)) {
                    errors.push(`Cycle detected involving block: ${blockId}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = GraphValidator;
