const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/desktop/WorkflowStudio.tsx');
let content = fs.readFileSync(file, 'utf8');

const simulatorCode = `
  const handleTestRun = async () => {
    toast.info('Initializing browser simulation...', { icon: '🔄' });
    const originalNodes = [...nodes];
    
    setNodes(ns => ns.map(n => ({ ...n, status: 'idle' })));
    
    for (let i = 0; i < nodes.length; i++) {
      await new Promise(r => setTimeout(r, 500)); 
      setNodes(ns => {
        const next = [...ns];
        next[i] = { ...next[i], status: 'running' };
        return next;
      });
      
      await new Promise(r => setTimeout(r, 1500)); 
      
      setNodes(ns => {
        const next = [...ns];
        next[i] = { ...next[i], status: 'success' };
        return next;
      });
    }
    toast.success('Simulation completed successfully!');
    
    setTimeout(() => {
      setNodes(originalNodes);
    }, 4000);
  };
`;

if (!content.includes('handleTestRun = async')) {
  content = content.replace(
    'const handleSave = async',
    simulatorCode + '\n  const handleSave = async'
  );
}

const testButtonRegex = /<button className="flex items-center gap-1\.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 transition-all hover:bg-white hover:bg-opacity-10"[\s\S]*?<Play className="w-3\.5 h-3\.5 text-emerald-400" \/> Test Run\s*<\/button>/;

content = content.replace(testButtonRegex, `<button onClick={handleTestRun} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 transition-all hover:bg-white hover:bg-opacity-10" style={{ background: '#ffffff0d', border: '1px solid #ffffff10' }}><Play className="w-3.5 h-3.5 text-emerald-400" /> Test Run</button>`);

fs.writeFileSync(file, content);
console.log('Simulator applied.');
