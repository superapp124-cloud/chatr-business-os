import React, { useState } from "react";
import {
 CheckCircle2,
 XCircle,
 AlertTriangle,
 ChevronDown,
 ChevronRight,
 Info,
} from "lucide-react";
import { AlertCard } from "./AlertCard";
import { TraceLog, TraceNode, MissionProgressState } from "./types";

const LOG_STYLES: Record<TraceLog["level"], { color: string; icon: JSX.Element }> = {
 INFO: { color: "text-zinc-400", icon: <Info size={11} className="text-zinc-500" /> },
 SUCCESS: { color: "text-emerald-400", icon: <CheckCircle2 size={11} className="text-emerald-500" /> },
 WARNING: { color: "text-amber-400", icon: <AlertTriangle size={11} className="text-amber-500" /> },
 ERROR: { color: "text-rose-400", icon: <XCircle size={11} className="text-rose-500" /> },
};

const NODE_ICON: Record<TraceNode["status"], JSX.Element> = {
 done: <CheckCircle2 size={12} className="text-emerald-500" />,
 failed: <XCircle size={12} className="text-rose-500" />,
 partial: <AlertTriangle size={12} className="text-amber-500" />,
 active: <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />,
};

function TraceLogList({ logs, active }: { logs: TraceLog[], active: boolean }) {
 const [expanded, setExpanded] = useState(false);

 if (!logs || logs.length === 0) return null;

 // Collapsed by default once a node settles; auto-expand while noisy/active
 const hasWarningsOrErrors = logs.some((l) => l.level === "WARNING" || l.level === "ERROR");

 return (
 <div className="mt-2">
 <button
 onClick={() => setExpanded((e) => !e)}
 className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
 >
 {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
 {logs.length} verification event{logs.length !== 1 ? "s" : ""}
 {hasWarningsOrErrors && !expanded && (
 <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-medium">
 attention
 </span>
 )}
 </button>

 {expanded && (
 <div className="mt-2 pl-1 border-l border-zinc-800 ml-1 space-y-1.5">
 {logs.map((log, i) => (
 <div key={i} className="flex items-start gap-1.5 pl-2 text-[10px] leading-relaxed">
 <span className="mt-0.5 shrink-0">{LOG_STYLES[log.level].icon}</span>
 <div>
 <span className={LOG_STYLES[log.level].color}>{log.message}</span>
 {log.provider && (
 <span className="ml-1.5 text-zinc-600">· {log.provider}</span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

export function ExecutionTrace({
 trace,
 missions,
 onReroute,
 onAcknowledge,
 approve,
 isApproving,
 selectedIntentId,
}: {
 trace: TraceNode[];
 missions?: Record<string, MissionProgressState>;
 onReroute?: (missionId: string) => void;
 onAcknowledge?: (missionId: string) => void;
 approve: (intentId: string) => void;
 isApproving: boolean;
 selectedIntentId: string;
}) {
 return (
 <div>
 <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-zinc-800 ml-1">
 {trace.map((node) => {
 const mission = node.mission_id ? missions?.[node.mission_id] : undefined;
 const statusIcon = NODE_ICON[node.status] || NODE_ICON["active"];

 return (
 <div key={node.id} className="relative pl-8 mb-4 last:mb-0">
 <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center z-10">
 {statusIcon}
 </div>

 <div className="text-secondary font-medium text-zinc-200">{node.title}</div>
 <div className="text-label text-zinc-500 mt-1">{node.description}</div>

 {node.logs && <TraceLogList logs={node.logs} active={node.status === 'active'} />}

 {node.payload && (
 <div className="mt-3 p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg shadow-inner">
 {node.payload.type === "markdown" && (
 <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto custom-scrollbar">
 {node.payload.data}
 </pre>
 )}
 {node.payload.type === "datagrid" && (
 <div className="overflow-x-auto">
 <table className="w-full text-left text-label text-zinc-400">
 <thead className="text-zinc-500 border-b border-zinc-800">
 <tr><th className="pb-2">Name</th><th className="pb-2">Role</th><th className="pb-2 text-right">Match</th></tr>
 </thead>
 <tbody>
 {node.payload.data.map((row: any) => (
 <tr key={row.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors">
 <td className="py-2 text-zinc-300 font-medium">{row.name}</td>
 <td className="py-2">{row.role}</td>
 <td className="py-2 text-emerald-400 text-right font-medium">{row.match}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 {node.payload.type === "approval" && (
 <div className="space-y-3">
 <div className="bg-zinc-900 p-3 rounded border border-zinc-800/80">
 <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">To: {node.payload.data.to}</div>
 <div className="text-label font-semibold text-zinc-200 mb-2">{node.payload.data.subject}</div>
 <div className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed">{node.payload.data.body}</div>
 </div>
 {node.status === 'active' && (
 <button onClick={() => approve(selectedIntentId)} disabled={isApproving} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-label font-bold rounded flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50">
 <CheckCircle2 size={14} /> {isApproving ? 'Approving...' : 'Approve & Send Emails'}
 </button>
 )}
 {node.status === 'done' && (
 <div className="w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-label font-bold rounded flex items-center justify-center gap-2">
 <CheckCircle2 size={14} /> Approved & Sent
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {mission &&
 (mission.status === "PARTIAL_SUCCESS" || mission.status === "REQUIRES_INTERVENTION") && (
 <div className="mt-3">
 <AlertCard
 mission={mission}
 onReroute={() => onReroute?.(mission.mission_id)}
 onAcknowledge={() => onAcknowledge?.(mission.mission_id)}
 />
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
}
