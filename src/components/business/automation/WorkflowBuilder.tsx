import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
 ReactFlow, 
 MiniMap, 
 Controls, 
 Background, 
 useNodesState, 
 useEdgesState,
 addEdge,
 Connection,
 Edge,
 NodeTypes
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Plus, Zap, Play, GitBranch, BrainCircuit } from 'lucide-react';

// Custom nodes
import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import AIDecisionNode from './nodes/AIDecisionNode';

const nodeTypes: NodeTypes = {
 trigger: TriggerNode,
 action: ActionNode,
 condition: ConditionNode,
 ai_decision: AIDecisionNode,
};

const initialNodes = [
 { 
 id: '1', 
 position: { x: 250, y: 100 }, 
 data: { label: 'New Customer in CRM' },
 type: 'trigger'
 },
 { 
 id: '2', 
 position: { x: 250, y: 250 }, 
 data: { label: 'Is high value customer?' },
 type: 'condition'
 },
 { 
 id: '3', 
 position: { x: 50, y: 400 }, 
 data: { label: 'Send Automated Email', prompt: '' },
 type: 'action'
 },
 { 
 id: '4', 
 position: { x: 450, y: 400 }, 
 data: { label: 'Personalized Intro', prompt: 'Draft a friendly welcome message mentioning our VIP benefits.' },
 type: 'ai_decision'
 }
];

const initialEdges = [
 { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#10b981' } },
 { id: 'e2-3', source: '2', target: '3', sourceHandle: 'false', animated: true, style: { stroke: '#f43f5e' } },
 { id: 'e2-4', source: '2', target: '4', sourceHandle: 'true', animated: true, style: { stroke: '#10b981' } }
];

interface WorkflowBuilderProps {
 workflowId: string;
}

export default function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
 const [nodes, setNodes, onNodesChange] = useNodesState([]);
 const [edges, setEdges, onEdgesChange] = useEdgesState([]);
 const [isLoading, setIsLoading] = useState(true);

 // Load from Supabase
 useEffect(() => {
 let isMounted = true;
 const loadWorkflow = async () => {
 setIsLoading(true);
 const { supabase } = await import('@/integrations/supabase/client');
 const { data, error } = await supabase
 .from('business_workflows')
 .select('nodes, edges')
 .eq('id', workflowId)
 .single();
 
 if (error) {
 console.error('Failed to load workflow data', error);
 } else if (isMounted && data) {
 setNodes(Array.isArray(data.nodes) && data.nodes.length > 0 ? data.nodes : initialNodes);
 setEdges(Array.isArray(data.edges) && data.edges.length > 0 ? data.edges : initialEdges);
 }
 if (isMounted) setIsLoading(false);
 };
 loadWorkflow();
 return () => { isMounted = false; };
 }, [workflowId, setNodes, setEdges]);

 // Save to Supabase (debounced)
 useEffect(() => {
 if (isLoading) return;
 const saveTimer = setTimeout(async () => {
 const { supabase } = await import('@/integrations/supabase/client');
 await supabase
 .from('business_workflows')
 .update({ nodes, edges })
 .eq('id', workflowId);
 }, 1000);
 return () => clearTimeout(saveTimer);
 }, [nodes, edges, workflowId, isLoading]);

 const onConnect = useCallback(
 (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
 [setEdges]
 );

 const addNode = (type: string, label: string) => {
 const newNode = {
 id: Date.now().toString(),
 type,
 position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 200 },
 data: { label, prompt: type === 'ai_decision' ? 'Configure prompt...' : undefined }
 };
 setNodes((nds) => [...nds, newNode]);
 };

 if (isLoading) {
 return <div className="flex items-center justify-center w-full h-full text-gray-500">Loading Canvas...</div>;
 }

 return (
 <div style={{ width: '100%', height: '100%' }} className="relative">
 {/* Node Adder Toolbar */}
 <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-black/50 backdrop-blur-md p-2 rounded-xl border border-gray-200 dark:border-white/10 shadow-lg flex flex-col gap-2">
 <div className="text-label font-semibold text-gray-500 dark:text-white/40 mb-1 px-2">ADD NODE</div>
 <Button variant="ghost" size="sm" className="justify-start text-emerald-600 dark:text-emerald-400" onClick={() => addNode('trigger', 'New Trigger')}>
 <Zap className="w-4 h-4 mr-2" /> Trigger
 </Button>
 <Button variant="ghost" size="sm" className="justify-start text-amber-600 dark:text-amber-400" onClick={() => addNode('condition', 'New Condition')}>
 <GitBranch className="w-4 h-4 mr-2" /> Condition
 </Button>
 <Button variant="ghost" size="sm" className="justify-start text-purple-600 dark:text-purple-400" onClick={() => addNode('ai_decision', 'AI Action')}>
 <BrainCircuit className="w-4 h-4 mr-2" /> AI Decision
 </Button>
 <Button variant="ghost" size="sm" className="justify-start text-blue-600 dark:text-blue-400" onClick={() => addNode('action', 'New Action')}>
 <Play className="w-4 h-4 mr-2" /> Action
 </Button>
 </div>

 <ReactFlow
 nodes={nodes}
 edges={edges}
 nodeTypes={nodeTypes}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
 onConnect={onConnect}
 fitView
 className="bg-gray-50 dark:bg-[#0B0F19]"
 defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2 } }}
 >
 <Controls className="bg-white dark:bg-[#1A1F2E] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white fill-current" />
 <MiniMap className="bg-white dark:bg-[#1A1F2E] mask-mode" maskColor="rgba(0,0,0,0.1)" />
 <Background gap={16} size={1.5} color="#aaa" />
 </ReactFlow>
 </div>
 );
}
