/**
 * Constitution Linter
 * 
 * Statically analyzes the codebase to prevent architectural drift.
 * Ensures rules from CONSTITUTION.md are enforced at CI-time.
 */

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, '../electron/chatr-core');
const RUNTIMES_DIR = path.join(CORE_DIR, 'services');

let violations = 0;

function logViolation(file, rule, message) {
    console.error(`❌ VIOLATION [${rule}] in ${file}`);
    console.error(`   ${message}\n`);
    violations++;
}

// Rule 1: Inter-service communication is exclusively via KernelEventBus.
function checkRuntimeIsolation() {
    if (!fs.existsSync(RUNTIMES_DIR)) return;

    const files = fs.readdirSync(RUNTIMES_DIR).filter(f => f.endsWith('.cjs') && f !== 'init.cjs' && f !== 'interfaces.cjs');
    
    for (const file of files) {
        const filePath = path.join(RUNTIMES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        let match;
        
        while ((match = requireRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.includes('./') && !importPath.includes('../') && importPath.endsWith('.cjs')) {
                logViolation(file, 'ISOLATION_RULE', `Directly requires sibling module "${importPath}". Communication must use EventBus.`);
            } else if (importPath.includes('../services/')) {
                 logViolation(file, 'ISOLATION_RULE', `Directly requires another service "${importPath}". Communication must use EventBus.`);
            }

            // Strict Observation Runtime Rules
            if (file === 'observation-service.cjs') {
                const forbiddenModules = [
                    'execution', 'policy', 'learning', 'mission-control', 'planner', 'capability-sdk'
                ];
                for (const forbidden of forbiddenModules) {
                    if (importPath.includes(forbidden)) {
                        logViolation(file, 'OBSERVATION_PURITY_RULE', `Observation Runtime cannot import "${forbidden}".`);
                    }
                }
            }

            // Strict Verification Runtime Rules
            if (file === 'verification-service.cjs') {
                const forbiddenModules = [
                    'observation', 'execution', 'policy', 'learning', 'intent-lifecycle', 'capability-sdk'
                ];
                for (const forbidden of forbiddenModules) {
                    if (importPath.includes(forbidden)) {
                        logViolation(file, 'VERIFICATION_PURITY_RULE', `Verification Runtime cannot import "${forbidden}".`);
                    }
                }
            }
        }

        // Strict Stewardship Runtime Rules
        if (file === 'stewardship-service.cjs') {
            if (content.includes('setInterval(') || content.includes('setTimeout(')) {
                logViolation(file, 'STEWARDSHIP_ANTI_POLLING_RULE', `Stewardship Service cannot use polling loops like setInterval. It must be event-driven.`);
            }

            const forbiddenModules = [
                'observation', 'verification', 'execution', 'policy', 'learning', 'intent-lifecycle'
            ];
            for (const forbidden of forbiddenModules) {
                if (content.includes(`require('../kernel/${forbidden}`)) {
                    logViolation(file, 'STEWARDSHIP_PURITY_RULE', `Stewardship Service cannot import "${forbidden}".`);
                }
            }
        }
    }
}

// Run checks
console.log('🏛️ Running Constitution Linter...\n');

checkRuntimeIsolation();

if (violations > 0) {
    console.error(`💥 Found ${violations} architectural violations. Build failed.`);
    process.exit(1);
} else {
    console.log('✅ Architecture conforms to Constitution.');
    process.exit(0);
}
