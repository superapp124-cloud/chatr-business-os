/**
 * CHATR Business OS — Advanced Data Provenance & Operational Diagnostic Modal
 *
 * Provides CTO-level audit breakdown for widgets:
 * - Time Dimension (Freshness Indicator, Last & Previous Refresh, Interval)
 * - Table / API Source & SQL Query
 * - Query Execution Duration & Cache Status (HIT / MISS / DIRECT)
 * - Subscription Reconnect Count & Error Log History
 * - L1-L5 Production Readiness Benchmark Level
 * - JSON Telemetry Export Functionality
 */

import React from 'react';
import { Database, Activity, Clock, ShieldCheck, X, Zap, RefreshCw, AlertTriangle, Layers, Timer, Download } from 'lucide-react';
import { ProvenanceMetadata } from '@/core/os/DataProvenanceService';

interface Props {
  meta: ProvenanceMetadata;
  onClose: () => void;
}

export const DataProvenanceModal: React.FC<Props> = ({ meta, onClose }) => {
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(meta, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatr_provenance_${meta.widgetId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181B23] border border-white/10 rounded-[20px] max-w-lg w-full p-6 space-y-4 shadow-level-3">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 font-bold text-base text-white">
            <Database className="h-4 w-4 text-[#6D5DF6]" /> Data Provenance & Telemetry
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#6D5DF6]/20 border border-[#6D5DF6]/40 text-[#6D5DF6] font-mono text-[11px] font-bold">
              Level {meta.readinessLevel} Verified
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Widget Title, Status & Freshness Indicator */}
        <div className="bg-[#090A0F] border border-white/10 p-3 rounded-[12px] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">{meta.widgetName}</div>
            <div className="text-[11px] font-mono text-gray-400 mt-0.5">ID: {meta.widgetId}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] font-mono text-[10px] font-bold">
              {meta.freshness}
            </span>
            <div className="flex items-center gap-1.5 bg-[#22C55E]/10 border border-[#22C55E]/30 px-2.5 py-1 rounded-full text-[#22C55E] text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              {meta.realtimeStatus} ({meta.latencyMs}ms)
            </div>
          </div>
        </div>

        {/* Diagnostic Metadata Fields */}
        <div className="space-y-3 text-xs">
          
          {/* Data Source */}
          <div className="space-y-1">
            <label className="text-gray-400 font-semibold uppercase tracking-wider text-[10px]">Data Source Table</label>
            <div className="bg-[#090A0F] border border-white/10 p-2.5 rounded-[10px] font-mono text-gray-200 text-[11px]">
              {meta.source}
            </div>
          </div>

          {/* SQL Query / Event Channel */}
          <div className="space-y-1">
            <label className="text-gray-400 font-semibold uppercase tracking-wider text-[10px]">SQL Query / Event Channel</label>
            <div className="bg-[#090A0F] border border-white/10 p-2.5 rounded-[10px] font-mono text-[#6D5DF6] text-[11px] whitespace-pre-wrap">
              {meta.queryOrChannel}
            </div>
          </div>

          {/* Performance & Cache Breakdown */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="bg-[#090A0F] border border-white/10 p-2 rounded-[10px]">
              <div className="text-[10px] text-gray-400 font-semibold">Exec Duration</div>
              <div className="text-xs font-extrabold text-[#22C55E] mt-0.5">{meta.queryDurationMs} ms</div>
            </div>
            <div className="bg-[#090A0F] border border-white/10 p-2 rounded-[10px]">
              <div className="text-[10px] text-gray-400 font-semibold">Cache Status</div>
              <div className="text-xs font-extrabold text-[#3B82F6] mt-0.5">{meta.cacheStatus}</div>
            </div>
            <div className="bg-[#090A0F] border border-white/10 p-2 rounded-[10px]">
              <div className="text-[10px] text-gray-400 font-semibold">Avg Interval</div>
              <div className="text-xs font-extrabold text-gray-300 mt-0.5">{meta.avgRefreshIntervalSec}s</div>
            </div>
            <div className="bg-[#090A0F] border border-white/10 p-2 rounded-[10px]">
              <div className="text-[10px] text-gray-400 font-semibold">Stale Records</div>
              <div className="text-xs font-extrabold text-[#22C55E] mt-0.5">{meta.staleRecordCount}</div>
            </div>
          </div>

          {/* Time Dimension Breakdown */}
          <div className="bg-[#090A0F] border border-white/10 p-2.5 rounded-[10px] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-500" /> Last Successful Refresh:
              </span>
              <span className="font-mono text-gray-200">{new Date(meta.lastRefreshTime).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3 text-gray-500" /> Previous Refresh:
              </span>
              <span className="font-mono text-gray-400">{new Date(meta.previousRefreshTime).toLocaleTimeString()}</span>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleExportJson}
            className="w-full bg-[#090A0F] hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white py-2.5 rounded-[12px] font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
          <button
            onClick={onClose}
            className="w-full bg-[#6D5DF6] hover:bg-[#5b4be0] text-white py-2.5 rounded-[12px] font-semibold text-xs transition-all shadow-level-2"
          >
            Close Telemetry
          </button>
        </div>

      </div>
    </div>
  );
};
