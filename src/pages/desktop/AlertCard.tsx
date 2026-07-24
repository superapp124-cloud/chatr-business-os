import React from "react";
import { AlertTriangle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { MissionProgressState, ProviderAttempt } from "./types";

const OUTCOME_LABEL: Record<ProviderAttempt["outcome"], string> = {
 SUCCESS: "Succeeded",
 EMPTY_POOL: "Pool exhausted",
 RATE_LIMITED: "Rate limited",
 HARD_FAILURE: "Failed",
};

export function AlertCard({
 mission,
 onReroute,
 onAcknowledge,
}: {
 mission: MissionProgressState;
 onReroute?: () => void;
 onAcknowledge?: () => void;
}) {
 const [showAudit, setShowAudit] = useState(false);
 const isIntervention = mission.status === "REQUIRES_INTERVENTION";

 const theme = isIntervention
 ? { border: "border-rose-900/50", bg: "bg-rose-950/20", icon: <XCircle size={16} className="text-rose-500" />, accent: "text-rose-400" }
 : { border: "border-amber-900/50", bg: "bg-amber-950/20", icon: <AlertTriangle size={16} className="text-amber-500" />, accent: "text-amber-400" };

 return (
 <div className={`rounded-lg border ${theme.border} ${theme.bg} p-3`}>
 <div className="flex items-start gap-2">
 <div className="mt-0.5">{theme.icon}</div>
 <div className="flex-1 min-w-0">
 <div className={`text-label font-semibold ${theme.accent}`}>
 {isIntervention ? "Requires Intervention" : "Mission Paused"}
 </div>
 <div className="text-label text-zinc-300 mt-1">
 {isIntervention
 ? `No providers succeeded for ${mission.capability}. Manual review needed.`
 : `Sourced ${mission.accumulated_count}/${mission.target_goal} for ${mission.capability}. All approved provider pools exhausted.`}
 </div>

 <button
 onClick={() => setShowAudit((s) => !s)}
 className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
 >
 {showAudit ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
 Provider attempts ({mission.provider_attempts.length})
 </button>

 {showAudit && (
 <div className="mt-2 space-y-1 pl-2 border-l border-zinc-800 ml-1">
 {mission.provider_attempts.map((a, i) => (
 <div key={i} className="text-[10px] text-zinc-500 flex justify-between">
 <span>
 {a.provider} — {OUTCOME_LABEL[a.outcome]}
 {a.retry_count > 0 ? ` (${a.retry_count} retries)` : ""}
 </span>
 <span className="text-zinc-600">+{a.contributed_count}</span>
 </div>
 ))}
 </div>
 )}

 <div className="flex gap-2 mt-3">
 {isIntervention ? (
 <button
 onClick={onReroute}
 className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
 >
 Review Failure & Reroute
 </button>
 ) : (
 <button
 onClick={onAcknowledge}
 className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
 >
 Acknowledge & Continue
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
