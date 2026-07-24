/**
 * CHATR Business OS — Developer AI Execution Trace Panel
 *
 * Real-time inspection panel visualizing the complete execution pipeline for AI requests:
 *   User Intent ➔ Intent Router ➔ BOS Retrieval ➔ Knowledge Graph ➔ Prompt Assembly ➔ Provider ➔ Inference ➔ Tool Execution
 */

import React, { useEffect, useState } from 'react';
import { EventBus } from '@/sdk/engines/EventBus';
import { Cpu, Database, GitBranch, Zap, CheckCircle2, AlertTriangle, Clock, Layers } from 'lucide-react';

export interface AITraceStep {
  id: string;
  timestamp: string;
  userIntent: string;
  routerTarget: string;
  bosObjectsCount: number;
  kgNodesCount: number;
  promptTokensEstimate: number;
  provider: string; // e.g. 'Ollama (qwen2.5)' or 'Rule Engine Fallback'
  inferenceMs: number;
  toolsExecuted: string[];
  totalMs: number;
  status: 'SUCCESS' | 'FALLBACK' | 'ERROR';
}

export const AITracePanel: React.FC = () => {
  const [traces, setTraces] = useState<AITraceStep[]>([
    {
      id: 'trace_seed_1',
      timestamp: new Date(Date.now() - 30000).toLocaleTimeString(),
      userIntent: 'Prepare me for my 2 PM meeting with TalentXcel',
      routerTarget: 'CRM & Calendar Intent Pipeline',
      bosObjectsCount: 4,
      kgNodesCount: 3,
      promptTokensEstimate: 1420,
      provider: 'Ollama (qwen2.5:latest)',
      inferenceMs: 1850,
      toolsExecuted: ['Calendar.getEvent', 'CRM.getLead', 'KG.getNodeEdges', 'FollowUp.draftEmail'],
      totalMs: 2150,
      status: 'SUCCESS'
    }
  ]);

  useEffect(() => {
    // Subscribe to AI execution trace events on EventBus
    const unsubscribe = EventBus.subscribe('*', 'AI_EXECUTION_TRACE', (payload: any) => {
      if (payload) {
        setTraces(prev => [payload as AITraceStep, ...prev.slice(0, 19)]);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-white font-mono text-xs shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-sm text-gray-200">AI Execution Pipeline Trace</span>
        </div>
        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
          Developer Mode Active
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {traces.map((t) => (
          <div key={t.id} className="bg-gray-900/80 border border-gray-800 rounded-lg p-3 space-y-2 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-300">"{t.userIntent}"</span>
              <span className="text-gray-500 text-[10px]">{t.timestamp}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] bg-black/40 p-2 rounded border border-gray-800/80">
              <div className="flex items-center gap-1.5 text-blue-300">
                <Database className="h-3.5 w-3.5 text-blue-400" />
                <span>BOS: <strong>{t.bosObjectsCount} objects</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-purple-300">
                <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                <span>KG: <strong>{t.kgNodesCount} nodes</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-300">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <span>Provider: <strong>{t.provider}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Latency: <strong>{t.totalMs}ms</strong></span>
              </div>
            </div>

            {t.toolsExecuted.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-gray-500">Tools:</span>
                {t.toolsExecuted.map((tool, i) => (
                  <span key={i} className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px] border border-gray-700">
                    ⚡ {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
