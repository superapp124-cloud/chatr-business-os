const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/desktop/WorkflowStudio.tsx');
let content = fs.readFileSync(file, 'utf8');

const schemaDef = `
// ── Capability Schema Registry ──
const capabilitySchemas: Partial<Record<NodeType, { id: string; label: string; type: 'string' | 'number' | 'boolean' | 'select' | 'text'; options?: string[] }[]>> = {
  ai_screen: [
    { id: 'model', label: 'AI Model', type: 'select', options: ['Ollama local model', 'GPT-4o', 'Claude 3.5 Sonnet'] },
    { id: 'prompt', label: 'System Prompt', type: 'text' },
    { id: 'threshold', label: 'Pass Threshold', type: 'number' },
  ],
  approval: [
    { id: 'sla', label: 'SLA Deadline (hours)', type: 'number' },
    { id: 'escalateTo', label: 'Escalate To', type: 'select', options: ['Manager', 'Director', 'HR', 'Finance'] },
    { id: 'requireComment', label: 'Require Comment', type: 'boolean' }
  ],
  ai_action: [
    { id: 'prompt', label: 'Instruction Prompt', type: 'text' },
    { id: 'temperature', label: 'Temperature', type: 'number' },
    { id: 'tools', label: 'Allowed Tools', type: 'select', options: ['None', 'Web Search', 'Database Query'] }
  ],
  email: [
    { id: 'recipient', label: 'Recipient', type: 'string' },
    { id: 'subject', label: 'Subject', type: 'string' },
    { id: 'template', label: 'Body Template', type: 'text' }
  ]
};
`;

if (!content.includes('Capability Schema Registry')) {
  content = content.replace(
    '// ── Right Panel: Node Workspace ──',
    schemaDef + '\n// ── Right Panel: Node Workspace ──'
  );
}

const oldConfigBlock = `            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Configuration</label>
              <div className="space-y-2">
                {node.type === 'approval' && (
                  <>
                    <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#ffffff06' }}>
                      <span className="text-slate-400 text-xs">SLA Deadline</span>
                      <span className="text-white text-xs font-medium">4 hours</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#ffffff06' }}>
                      <span className="text-slate-400 text-xs">Escalate To</span>
                      <span className="text-white text-xs font-medium">Senior Manager</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#ffffff06' }}>
                      <span className="text-slate-400 text-xs">Require Comment</span>
                      <span className="text-emerald-400 text-xs font-medium">Yes</span>
                    </div>
                  </>
                )}
                {node.type === 'ai_screen' && (
                  <>
                    <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#ffffff06' }}>
                      <span className="text-slate-400 text-xs">AI Model</span>
                      <span className="text-white text-xs font-medium">Ollama local model</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#ffffff06' }}>`;

const configRegex = /<div>\s*<label className="text-\[10px\] text-slate-500 uppercase tracking-wider block mb-1\.5">Configuration<\/label>[\s\S]*?(?=<\/div>\s*<\/div>\s*\{\/\* ── Comments ── \*\/)/;

const newConfigBlock = `            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Configuration</label>
              <div className="space-y-3">
                {(capabilitySchemas[node.type] || []).map(field => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-xs text-slate-400">{field.label}</label>
                    {field.type === 'text' ? (
                      <textarea className="w-full bg-[#ffffff06] border border-[#ffffff10] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#6366f1] transition-colors resize-none" rows={3} placeholder={\`Enter \${field.label.toLowerCase()}...\`} />
                    ) : field.type === 'select' ? (
                      <select className="w-full bg-[#ffffff06] border border-[#ffffff10] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#6366f1] transition-colors appearance-none">
                        {field.options?.map(opt => <option key={opt} value={opt} className="bg-[#0d0f1a]">{opt}</option>)}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4 rounded bg-[#ffffff06] border-[#ffffff10] text-[#6366f1]" />
                        <span className="text-xs text-slate-300">Enabled</span>
                      </div>
                    ) : (
                      <input type={field.type === 'number' ? 'number' : 'text'} className="w-full bg-[#ffffff06] border border-[#ffffff10] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#6366f1] transition-colors" placeholder={\`Enter \${field.label.toLowerCase()}...\`} />
                    )}
                  </div>
                ))}
                {!(capabilitySchemas[node.type]) && (
                  <div className="p-3 rounded-xl border border-dashed border-[#ffffff15] text-center">
                    <p className="text-xs text-slate-500">No schema defined for this capability.</p>
                  </div>
                )}
              </div>`;

content = content.replace(configRegex, newConfigBlock);

fs.writeFileSync(file, content);
console.log('Property Panel applied.');
