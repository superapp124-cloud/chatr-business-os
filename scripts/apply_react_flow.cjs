const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/desktop/WorkflowStudio.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
if (!content.includes('@xyflow/react')) {
  content = content.replace(
    "import { useBusinessWorkflows, BusinessWorkflow } from '@/hooks/useBusinessWorkflows';",
    "import { useBusinessWorkflows, BusinessWorkflow } from '@/hooks/useBusinessWorkflows';\nimport { ReactFlow, Controls, Background, Handle, Position, MarkerType, useNodesState, useEdgesState, addEdge, Connection, Edge } from '@xyflow/react';\nimport '@xyflow/react/dist/style.css';"
  );
}

// 2. Add React Flow Custom Nodes right before export const WorkflowStudio
const customNodesCode = `
// ── React Flow Custom Nodes ──
const CustomReactFlowNode = ({ data, selected }: any) => {
  return (
    <div className="w-[500px]">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <NodeCard 
        node={data.node} 
        index={0} 
        isSelected={selected || data.isSelected} 
        onClick={data.onClick} 
      />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

const HeaderNode = ({ data }: any) => (
  <div className="w-[600px] pointer-events-none">
    <div className="p-5 rounded-2xl" style={{ background: '#0d0f1a', border: '1px solid #6366f128' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-bold text-lg">{data.workflowName}</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#22c55e20', color: '#22c55e' }}>Live</span>
          </div>
          <p className="text-slate-400 text-sm">End-to-end hiring pipeline with AI screening, multi-level approvals, and automated onboarding</p>
        </div>
      </div>
      <div className="flex items-center gap-5 mt-4 pt-4" style={{ borderTop: '1px solid #ffffff08' }}>
        {[
          { label: 'Owner', value: 'Arshid' },
          { label: 'Version', value: 'v12' },
          { label: 'Team', value: '5 members' },
          { label: 'Runs Today', value: '842' },
          { label: 'Avg Duration', value: '18 min' },
        ].map((m, i) => (
          <div key={i} className="text-center">
            <p className="text-white text-sm font-bold">{m.value}</p>
            <p className="text-slate-500 text-[10px]">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const StartNode = () => (
  <div className="flex justify-center">
    <div className="px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
      ● Workflow Start
    </div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

const EndNode = ({ data }: any) => (
  <div className="flex flex-col items-center">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <button onClick={data.onAddStep}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 transition-all mb-4 bg-[#0d0f1a]">
      <Plus className="w-4 h-4" /> Add Step
    </button>
    <div className="w-px h-4 bg-slate-700 mb-4" />
    <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#0d0f1a]" style={{ color: '#64748b', border: '1px solid #ffffff10' }}>
      ● Workflow End
    </div>
  </div>
);

const rfNodeTypes = { custom: CustomReactFlowNode, header: HeaderNode, start: StartNode, end: EndNode };

`;

if (!content.includes('CustomReactFlowNode')) {
  content = content.replace(
    'export const WorkflowStudio: React.FC = () => {',
    customNodesCode + '\nexport const WorkflowStudio: React.FC = () => {'
  );
}

// 3. Replace the canvas area
const canvasRegex = /\/\* Canvas Area \*\/[\s\S]*?(?=\s*\{?\/\* ── BOTTOM PANEL ── \*\/)/;

const reactFlowCode = `
          /* Canvas Area - React Flow Integration */
          <div className="flex-1 overflow-hidden relative">
            <ReactFlow
              nodes={[
                { id: 'header', type: 'header', position: { x: -50, y: -200 }, data: { workflowName }, draggable: false, selectable: false },
                { id: 'start', type: 'start', position: { x: 200, y: 0 }, data: {}, draggable: false, selectable: false },
                ...nodes.map((node, i) => ({
                  id: node.id,
                  type: 'custom',
                  position: { x: 25, y: i * 180 + 100 },
                  data: { node, isSelected: selectedNode?.id === node.id, onClick: () => setSelectedNode(selectedNode?.id === node.id ? null : node) },
                })),
                { id: 'end', type: 'end', position: { x: 250, y: nodes.length * 180 + 100 }, data: { onAddStep: () => setLeftTab('blocks') }, draggable: false, selectable: false }
              ]}
              edges={[
                ...nodes.map((node, i) => ({
                  id: i === 0 ? \`e-start-\${node.id}\` : \`e-\${nodes[i-1].id}-\${node.id}\`,
                  source: i === 0 ? 'start' : nodes[i-1].id,
                  target: node.id,
                  type: 'smoothstep',
                  style: { stroke: '#475569', strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
                })),
                {
                  id: \`e-end\`,
                  source: nodes.length > 0 ? nodes[nodes.length-1].id : 'start',
                  target: 'end',
                  type: 'smoothstep',
                  style: { stroke: '#475569', strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
                }
              ]}
              nodeTypes={rfNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#ffffff" gap={28} size={1} opacity={0.05} />
            </ReactFlow>
          </div>
          )}
`;

content = content.replace(canvasRegex, reactFlowCode);

fs.writeFileSync(file, content);
console.log('React Flow integration applied.');
