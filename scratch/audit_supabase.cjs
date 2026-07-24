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

const tableUsage = {};
const unusedOrDeadTables = new Set();
const operationsMap = {
    'select': 0,
    'insert': 0,
    'update': 0,
    'delete': 0,
    'upsert': 0,
    'on': 0 // Realtime
};

for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    // Match .from('table_name') or .from("table_name") or .from(`table_name`)
    const fromRegex = /\.from\(['"`]([a-zA-Z0-9_]+)['"`]\)/g;
    let match;
    
    while ((match = fromRegex.exec(content)) !== null) {
        const table = match[1];
        if (!tableUsage[table]) {
            tableUsage[table] = {
                files: new Set(),
                select: 0,
                insert: 0,
                update: 0,
                delete: 0,
                upsert: 0,
                realtime: 0
            };
        }
        
        tableUsage[table].files.add(file.replace(rootDir, '').replace(/\\/g, '/'));
        
        // Context around match to determine operation
        const contextStart = Math.max(0, match.index - 50);
        const contextEnd = Math.min(content.length, match.index + 200);
        const context = content.substring(contextStart, contextEnd).toLowerCase();
        
        if (context.includes('.select(')) tableUsage[table].select++;
        if (context.includes('.insert(')) tableUsage[table].insert++;
        if (context.includes('.update(')) tableUsage[table].update++;
        if (context.includes('.delete(')) tableUsage[table].delete++;
        if (context.includes('.upsert(')) tableUsage[table].upsert++;
        if (context.includes('.on(') && context.includes('postgres_changes')) tableUsage[table].realtime++;
    }
    
    // Also track raw string queries if any (e.g. supabase.rpc)
    const rpcRegex = /\.rpc\(['"`]([a-zA-Z0-9_]+)['"`]/g;
    while ((match = rpcRegex.exec(content)) !== null) {
        const rpc = match[1];
        if (!tableUsage['RPC_' + rpc]) {
            tableUsage['RPC_' + rpc] = { files: new Set(), calls: 0 };
        }
        tableUsage['RPC_' + rpc].files.add(file.replace(rootDir, '').replace(/\\/g, '/'));
        tableUsage['RPC_' + rpc].calls++;
    }
}

// Format output
const output = {};
for (const table in tableUsage) {
    if (tableUsage[table].files) {
        tableUsage[table].files = Array.from(tableUsage[table].files);
    }
    output[table] = tableUsage[table];
}

fs.writeFileSync(path.join(__dirname, 'supabase_audit.json'), JSON.stringify(output, null, 2));
console.log("Supabase audit complete. Output to scratch/supabase_audit.json");
