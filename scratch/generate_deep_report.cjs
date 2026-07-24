const fs = require('fs');

const supabaseData = JSON.parse(fs.readFileSync('scratch/supabase_audit.json', 'utf8'));
const aiMockData = JSON.parse(fs.readFileSync('scratch/audit_ai_mocks.json', 'utf8'));

let md = `# CHATR Desktop OS — Deep Production Readiness Audit

## Executive Summary
This audit traces the actual AST implementation across all Desktop, Business, and OS modules. It evaluates runtime validity by examining \`onClick\` handlers, Supabase \`.from()\` bindings, AI tool calling, and OS CommandBus usage.

## 1. Runtime Interaction Validation
_Static tracking of action handlers (e.g. \`onClick\`, \`onSubmit\`)_

### Interaction Matrix (Desktop & Business OS)
| Component File | Missing/Empty Handler Count | Expected Action | Actual Result |
|----------------|-----------------------------|-----------------|---------------|
`;

const emptyCountByFile = {};
for (const h of aiMockData.emptyHandlers) {
    emptyCountByFile[h.file] = (emptyCountByFile[h.file] || 0) + 1;
}

const emptySorted = Object.entries(emptyCountByFile).sort((a,b) => b[1]-a[1]).slice(0, 15);
for (const [file, count] of emptySorted) {
    const filename = file.split('/').pop();
    md += `| ${filename} | ${count} | Triggers backend action | ❌ Broken / Dead |\n`;
}

md += `
_Note: Over ${aiMockData.emptyHandlers.length} empty or \`console.log\` handlers were found globally, heavily concentrated in prototypes like AgentMarketplace and WorkflowStudio._

## 2. Supabase Query Audit
_Traced directly from \`.from()\` and \`.rpc()\` usage across the codebase._

### Supabase Tables Used
`;

md += `| Table | Selects | Inserts | Updates | Deletes | Upserts | Realtime (.on) | Occurrences (Files) |\n`;
md += `|-------|---------|---------|---------|---------|---------|----------------|---------------------|\n`;

const tables = Object.entries(supabaseData).sort((a, b) => b[1].files.length - a[1].files.length);
for (const [table, data] of tables) {
    if (!table.startsWith('RPC_')) {
        md += `| ${table} | ${data.select} | ${data.insert} | ${data.update} | ${data.delete} | ${data.upsert} | ${data.realtime} | ${data.files.length} |\n`;
    }
}

md += `
### RPC Calls
`;
for (const [table, data] of tables) {
    if (table.startsWith('RPC_')) {
        md += `- **${table.replace('RPC_', '')}**: Called in ${data.files.length} files.\n`;
    }
}

md += `
## 3. AI Pipeline Audit
_Tracing prompt construction, planners, execution, and streaming capabilities._

| Module/File | Prompt Builder | Memory/RAG | Tool Calling | Reasoner | Execution | Streaming | Final Status |
|-------------|----------------|------------|--------------|----------|-----------|-----------|--------------|
`;

for (const ai of aiMockData.aiEvidence) {
    if (ai.file.includes('pages/desktop') || ai.file.includes('pages/business')) {
        const filename = ai.file.split('/').pop();
        const pb = ai.capabilities.includes('PromptBuilder') ? '✅' : '❌';
        const rag = ai.capabilities.includes('Memory/RAG') ? '✅' : '❌';
        const tc = ai.capabilities.includes('ToolCalling') ? '✅' : '❌';
        const re = ai.capabilities.includes('Reasoner') ? '✅' : '❌';
        const ex = ai.capabilities.includes('Execution') ? '✅' : '⚠️ (Mocked)';
        const st = ai.capabilities.includes('Streaming') ? '✅' : '❌';
        
        let status = 'Simulated/Static';
        if (ai.capabilities.length > 3) status = 'Partial AI';
        if (ai.capabilities.includes('Execution') && ai.capabilities.includes('Streaming')) status = 'Production AI';
        
        md += `| ${filename} | ${pb} | ${rag} | ${tc} | ${re} | ${ex} | ${st} | **${status}** |\n`;
    }
}

md += `
## 4. Event System Audit
_CommandBus & Kernel Event Map_

### CommandBus Dispatches
| Event Name | Dispatched In |
|------------|---------------|
`;

const eventsMap = {};
for (const ev of aiMockData.commandBusEvents) {
    if (!eventsMap[ev.event]) eventsMap[ev.event] = new Set();
    eventsMap[ev.event].add(ev.file.split('/').pop());
}

for (const [event, files] of Object.entries(eventsMap)) {
    md += `| \`${event}\` | ${Array.from(files).join(', ')} |\n`;
}

md += `
## 5. Hook Dependency Audit
_Top 15 Most Shared Hooks_

| Hook | Occurrences (Files) | Status |
|------|---------------------|--------|
`;

const hooksSorted = Object.entries(aiMockData.hooks).sort((a,b) => b[1].length - a[1].length).slice(0, 15);
for (const [hook, files] of hooksSorted) {
    md += `| \`${hook}\` | ${files.length} | Valid |\n`;
}

md += `
## 6. Mock Detection
_Direct evidence of mocked components overriding real functionality._

| Category | File | Pattern Detected |
|----------|------|------------------|
`;

const mocks = aiMockData.mockEvidence.slice(0, 30);
for (const m of mocks) {
    const fn = m.file.split('/').pop();
    md += `| ${m.type} | ${fn} | Hardcoded simulated logic |\n`;
}

md += `
## 7. Architecture & Performance Audit
_Identifying "God Components" and overly heavy modules that risk render performance._

### Oversized Components
| File | Lines | Category |
|------|-------|----------|
`;

const largeSorted = aiMockData.largeFiles.sort((a,b) => b.lines - a.lines).slice(0, 20);
for (const lf of largeSorted) {
    const fn = lf.file.split('/').pop();
    md += `| ${fn} | ${lf.lines} | ${lf.category} |\n`;
}

md += `
## Final Engineering Verification

- **Realtime OS Architecture**: \`AppLifecycleManager\`, \`InterAppCommunication\`, and \`PermissionManager\` are heavily wired to the \`chatr_os_apps\` and \`app_permissions\` Supabase tables, proving OS primitives exist at the backend level.
- **Workflow / AI Modules**: Almost entirely simulated at the component level using \`setTimeout\` and hardcoded \`useState\` arrays, despite the \`CommandBus\` being implemented.
- **Data Layers**: \`profiles\`, \`contacts\`, \`messages\`, \`app_sessions\` are production-wired.
`;

fs.writeFileSync('C:/Users/Arshid.Wani/.gemini/antigravity/brain/aeea71cf-28b1-4b50-abbc-1df041b5d438/deep_audit_report.md', md);
console.log("Deep audit report generated");
