const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/desktop/WorkflowStudio.tsx');
let content = fs.readFileSync(file, 'utf8');

const cmdPaletteCode = `
// ── Automation OS Shell (Command Palette) ──
const CommandPalette = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const commands = [
    { id: 'run', label: 'Run Workflow', icon: <Play className="w-4 h-4 text-emerald-400" />, action: () => toast.success('Dispatched: RUN_WORKFLOW') },
    { id: 'compile', label: 'Compile to v1.0', icon: <Code2 className="w-4 h-4 text-indigo-400" />, action: () => toast.success('Dispatched: COMPILE_WORKFLOW') },
    { id: 'logs', label: 'Open Telemetry Console', icon: <Activity className="w-4 h-4 text-purple-400" />, action: () => toast.success('Dispatched: OPEN_TELEMETRY') },
    { id: 'add-email', label: 'Add Email Capability', icon: <Mail className="w-4 h-4 text-slate-400" />, action: () => toast.success('Dispatched: CREATE_NODE') },
    { id: 'add-ai', label: 'Add AI Agent Capability', icon: <Bot className="w-4 h-4 text-slate-400" />, action: () => toast.success('Dispatched: CREATE_NODE') },
  ].filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" style={{ background: '#000000aa', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: '#0d0f1a', border: '1px solid #ffffff15' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3" style={{ borderBottom: '1px solid #ffffff10' }}>
          <Search className="w-5 h-5 text-slate-500 mr-3" />
          <input 
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && commands.length > 0) {
                commands[0].action();
                onClose();
              }
            }}
            placeholder="Search commands, capabilities, or variables... (Ctrl+K)" 
            className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-slate-500"
          />
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-white bg-opacity-5 border border-white border-opacity-10">ESC</span>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {commands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No commands found.</div>
          ) : (
            commands.map((cmd, idx) => (
              <button 
                key={cmd.id} 
                onClick={() => { cmd.action(); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white hover:bg-opacity-5 transition-colors text-left"
                style={{ background: idx === 0 ? '#ffffff0a' : 'transparent' }}
              >
                <div className="w-8 h-8 rounded-lg bg-[#ffffff0a] flex items-center justify-center flex-shrink-0">
                  {cmd.icon}
                </div>
                <span className="text-white text-sm font-medium">{cmd.label}</span>
                {idx === 0 && <span className="ml-auto text-[10px] text-slate-500">↵ to execute</span>}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 bg-[#ffffff03] border-t border-[#ffffff0a] flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3" /> Navigate</span>
            <span className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3" /> Execute</span>
          </div>
          <span className="text-[10px] text-slate-600 font-bold tracking-wider">AUTOMATION OS</span>
        </div>
      </div>
    </div>
  );
};
`;

if (!content.includes('Automation OS Shell (Command Palette)')) {
  content = content.replace(
    '// ── React Flow Custom Nodes ──',
    cmdPaletteCode + '\n// ── React Flow Custom Nodes ──'
  );
}

const stateDef = `  const [showCommandPalette, setShowCommandPalette] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
`;

if (!content.includes('showCommandPalette')) {
  content = content.replace(
    '  const [showAIBuilder, setShowAIBuilder] = useState(false);',
    '  const [showAIBuilder, setShowAIBuilder] = useState(false);\n' + stateDef
  );
}

if (!content.includes('<CommandPalette')) {
  content = content.replace(
    '{/* ══ AI BUILDER MODAL ══ */}',
    '<CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />\n\n      {/* ══ AI BUILDER MODAL ══ */}'
  );
}

fs.writeFileSync(file, content);
console.log('Command Palette applied.');
