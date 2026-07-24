import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export default function ActionNode({ data, selected }: NodeProps) {
 return (
 <div className={`px-4 py-3 shadow-md rounded-xl bg-white dark:bg-[#1A1F2E] border-2 transition-all ${selected ? 'border-primary shadow-primary/20' : 'border-gray-200 dark:border-white/10'}`}>
 <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white dark:border-[#1A1F2E]" />
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500">
 <Play className="w-4 h-4" />
 </div>
 <div>
 <div className="text-label font-semibold uppercase tracking-wider text-blue-500">Action</div>
 <div className="text-secondary font-medium text-gray-900 dark:text-white mt-0.5">{data.label as string}</div>
 </div>
 </div>
 <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white dark:border-[#1A1F2E]" />
 </div>
 );
}
