import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export default function ConditionNode({ data, selected }: NodeProps) {
 return (
 <div className={`px-4 py-3 shadow-md rounded-xl bg-white dark:bg-[#1A1F2E] border-2 transition-all ${selected ? 'border-primary shadow-primary/20' : 'border-gray-200 dark:border-white/10'}`}>
 <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-white dark:border-[#1A1F2E]" />
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-500">
 <GitBranch className="w-4 h-4" />
 </div>
 <div>
 <div className="text-label font-semibold uppercase tracking-wider text-amber-500">Condition</div>
 <div className="text-secondary font-medium text-gray-900 dark:text-white mt-0.5">{data.label as string}</div>
 </div>
 </div>
 {/* For conditions we typically have True/False outputs */}
 <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#1A1F2E]" style={{ left: '30%' }} />
 <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-red-500 border-2 border-white dark:border-[#1A1F2E]" style={{ left: '70%' }} />
 
 {/* Add little labels below for true/false if desired, or let the user wire them */}
 </div>
 );
}
