import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BrainCircuit } from 'lucide-react';

export default function AIDecisionNode({ data, selected }: NodeProps) {
 return (
 <div className={`px-4 py-3 shadow-md rounded-xl bg-white dark:bg-[#1A1F2E] border-2 transition-all ${selected ? 'border-primary shadow-primary/20' : 'border-gray-200 dark:border-white/10'}`}>
 <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-[#1A1F2E]" />
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-500">
 <BrainCircuit className="w-4 h-4" />
 </div>
 <div>
 <div className="text-label font-semibold uppercase tracking-wider text-purple-500">AI Decision</div>
 <div className="text-secondary font-medium text-gray-900 dark:text-white mt-0.5">{data.label as string}</div>
 </div>
 </div>
 
 {data.prompt && (
 <div className="mt-2 text-label text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-black/20 p-2 rounded-md border border-gray-100 dark:border-white/5 line-clamp-2">
 "{data.prompt as string}"
 </div>
 )}
 </div>
 
 {/* AI Decision can have dynamic outputs, but we'll provide standard ones for now */}
 <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-[#1A1F2E]" />
 </div>
 );
}
