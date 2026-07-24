const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            results.push(fullPath);
        }
    }
    return results;
}

const allFiles = walk(rootDir);

const report = {
    emptyHandlers: [],
    aiEvidence: [],
    mockEvidence: [],
    largeFiles: [],
    commandBusEvents: [],
    hooks: {}
};

for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = file.replace(rootDir, '').replace(/\\/g, '/');
    const lines = content.split('\n');
    
    // Large files
    if (lines.length > 500) {
        report.largeFiles.push({ file: relativePath, lines: lines.length, category: lines.length > 1000 ? 'God Component' : 'Large Component' });
    }
    
    // Empty handlers check (onClick={() => {}}, onClick={() => console.log(...)})
    // Also checking placeholder comments
    const emptyHandlerRegex = /onClick=\{\s*\(\s*\)\s*=>\s*\{\s*(?:\/\/[^\n]*|\s*|console\.log\([^)]*\);?)\s*\}\s*\}/g;
    let match;
    while ((match = emptyHandlerRegex.exec(content)) !== null) {
        report.emptyHandlers.push({ file: relativePath, index: match.index });
    }
    
    // Mocks: setTimeout AI simulations, fake arrays
    const setTimeoutRegex = /setTimeout\(\s*\(\s*\)\s*=>\s*\{[^}]*(bot|ai|response|mock|typing)/gi;
    if (setTimeoutRegex.test(content)) {
        report.mockEvidence.push({ file: relativePath, type: 'Simulated setTimeout' });
    }
    if (/Math\.random\(\)/.test(content) && (relativePath.includes('pages/desktop') || relativePath.includes('pages/business'))) {
        report.mockEvidence.push({ file: relativePath, type: 'Math.random() data' });
    }
    if (/faker/.test(content)) {
        report.mockEvidence.push({ file: relativePath, type: 'faker.js' });
    }
    if (/\[\s*\{\s*(id:|name:|title:)[^\]]+\]/s.test(content) && content.includes('useState') && lines.length > 100) {
        report.mockEvidence.push({ file: relativePath, type: 'Hardcoded useState Array' });
    }
    if (/dummy|mockData|sampleData/i.test(content)) {
        report.mockEvidence.push({ file: relativePath, type: 'Dummy/Mock variables' });
    }

    // AI Pipeline Tracing
    if (content.includes('prompt =') || content.includes('generateText') || content.includes('useCopilot') || content.includes('ai.execute') || content.includes('LLM')) {
        let aiCapabilities = [];
        if (content.includes('prompt')) aiCapabilities.push('PromptBuilder');
        if (content.includes('memory') || content.includes('vector') || content.includes('embedding')) aiCapabilities.push('Memory/RAG');
        if (content.includes('tool') || content.includes('function_call')) aiCapabilities.push('ToolCalling');
        if (content.includes('stream') || content.includes('ReadableStream')) aiCapabilities.push('Streaming');
        if (content.includes('planner') || content.includes('reasoning')) aiCapabilities.push('Reasoner');
        if (content.includes('execute') && !content.includes('setTimeout')) aiCapabilities.push('Execution');
        
        report.aiEvidence.push({ file: relativePath, capabilities: aiCapabilities });
    }
    
    // CommandBus and Events
    const cbRegex = /CommandBus\.(dispatch|on)\(\s*\{\s*type:\s*['"`]([^'"`]+)['"`]/g;
    while ((match = cbRegex.exec(content)) !== null) {
        report.commandBusEvents.push({ file: relativePath, action: match[1], event: match[2] });
    }
    
    // Hooks usage
    const useRegex = /use[A-Z][a-zA-Z0-9_]+/g;
    while ((match = useRegex.exec(content)) !== null) {
        const hook = match[0];
        if (!report.hooks[hook]) report.hooks[hook] = new Set();
        report.hooks[hook].add(relativePath);
    }
}

// Convert Sets to Arrays
for (const hook in report.hooks) {
    report.hooks[hook] = Array.from(report.hooks[hook]);
}

fs.writeFileSync(path.join(__dirname, 'audit_ai_mocks.json'), JSON.stringify(report, null, 2));
console.log("AI, Mocks, Hooks and Architecture audit complete. Output to scratch/audit_ai_mocks.json");
