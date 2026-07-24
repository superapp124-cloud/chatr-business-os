const fs = require('fs');
const path = require('path');

const targetDirs = [
    'src/pages/desktop',
    'src/pages/business'
];

const report = {};

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let hasSupabase = content.includes('supabase') || content.includes('useSupabaseClient');
    let hasUseQuery = content.includes('useQuery') || content.includes('useMutation');
    let hasAi = content.includes('useChat') || content.includes('openai') || content.includes('gemini') || content.includes('ai-') || content.includes('useAssistant');
    
    let hasMock = content.toLowerCase().includes('mock') || content.toLowerCase().includes('dummy');
    let hasHardcodedArrays = /useState\(\s*\[\s*\{/.test(content);
    let isFake = content.toLowerCase().includes('placeholder') || content.toLowerCase().includes('coming soon');
    let hasTodo = content.toLowerCase().includes('todo');
    
    // Look for global state
    let hasZustand = content.includes('zustand') || content.includes('useStore');
    let hasContext = content.includes('useContext');
    
    let aiStatus = 'Disconnected';
    if (hasAi) aiStatus = 'Partial AI'; // Need deeper check, defaulting to Partial
    if (hasAi && content.includes('stream')) aiStatus = 'Production AI';
    
    let backendStatus = 'Disconnected';
    if (hasSupabase || hasUseQuery) backendStatus = 'Backend Connected';
    if ((hasSupabase || hasUseQuery) && hasMock) backendStatus = 'Partially Connected';
    if (hasMock && !hasSupabase && !hasUseQuery) backendStatus = 'Mock';
    
    // Determine overall working % roughly
    let workingPercent = 100;
    if (hasMock || hasHardcodedArrays) workingPercent -= 40;
    if (isFake) workingPercent -= 30;
    if (backendStatus === 'Disconnected') workingPercent -= 20;
    
    workingPercent = Math.max(0, workingPercent);
    
    return {
        path: filePath,
        lines: lines.length,
        hasSupabase,
        hasUseQuery,
        hasAi,
        hasMock,
        hasHardcodedArrays,
        isFake,
        hasTodo,
        hasZustand,
        hasContext,
        aiStatus,
        backendStatus,
        workingPercent
    };
}

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            report[fullPath] = analyzeFile(fullPath);
        }
    }
}

for (const dir of targetDirs) {
    scanDir(path.join(__dirname, '..', dir));
}

// Print report
console.log(JSON.stringify(report, null, 2));
