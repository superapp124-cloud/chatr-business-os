import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw, Shield } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RealityLevel = 0 | 1 | 2 | 3 | 4;
type Maturity = 'Prototype' | 'Experimental' | 'Beta' | 'Production' | 'Certified';
type HealthStatus = 'healthy' | 'degraded' | 'offline' | 'unknown';

interface ConnectorHealth {
 id: string;
 name: string;
 status: HealthStatus;
 latencyMs: number;
 successRate: number;
 failureRate: number;
 lastFailure: string | null;
 version: string;
 capabilities: string[];
 realityLevel: RealityLevel;
 maturity: Maturity;
}

interface ReadinessArea {
 label: string;
 score: number;
 note: string;
}

// ─── Static registry — mirrors kernel ConnectorRegistry ──────────────────────

const CONNECTOR_REGISTRY: Pick<ConnectorHealth, 'id' | 'name' | 'version' | 'capabilities' | 'realityLevel' | 'maturity'>[] = [
 { id: 'zomato', name: 'Zomato', version: '1.0', capabilities: ['DISCOVER', 'FETCH_MENU', 'CHECKOUT', 'TRACK'], realityLevel: 1, maturity: 'Prototype' },
 { id: 'swiggy', name: 'Swiggy', version: '1.0', capabilities: ['DISCOVER', 'FETCH_MENU', 'CHECKOUT', 'TRACK'], realityLevel: 1, maturity: 'Prototype' },
 { id: 'makemytrip', name: 'MakeMyTrip', version: '1.0', capabilities: ['DISCOVER'], realityLevel: 1, maturity: 'Prototype' },
 { id: 'irctc', name: 'IRCTC', version: '1.0', capabilities: ['DISCOVER', 'FETCH_SCHEDULE', 'CHECKOUT', 'TRACK'], realityLevel: 1, maturity: 'Prototype' },
 { id: 'utility', name: 'Utility (BESCOM/BSES)',version: '1.0', capabilities: ['DISCOVER', 'FETCH_BILL', 'CHECKOUT'], realityLevel: 1, maturity: 'Prototype' },
 { id: 'passport_seva', name: 'Passport Seva', version: '1.0', capabilities: ['DISCOVER', 'FETCH_SLOTS', 'CHECKOUT'], realityLevel: 1, maturity: 'Prototype' },
];

const READINESS_AREAS: ReadinessArea[] = [
 { label: 'Kernel', score: 100, note: 'Feature complete, certified' },
 { label: 'Discovery', score: 100, note: 'Registry, normalizer, ranking' },
 { label: 'Sessions', score: 100, note: 'State machine, vault, prediction' },
 { label: 'Transactions', score: 100, note: 'Idempotency, audit log, recovery' },
 { label: 'Providers', score: 20, note: 'L1 mocks only — real wiring pending' },
 { label: 'UX', score: 70, note: 'Reference experience exists' },
 { label: 'Observability', score: 80, note: 'Reality Validator + Health Dashboard' },
];

const REALITY_LABELS: Record<RealityLevel, { label: string; color: string }> = {
 0: { label: 'L0 · Unit Test', color: 'text-gray-500 bg-gray-800' },
 1: { label: 'L1 · Mock', color: 'text-purple-300 bg-purple-950' },
 2: { label: 'L2 · Sandbox', color: 'text-blue-300 bg-blue-950' },
 3: { label: 'L3 · Production', color: 'text-green-300 bg-green-950' },
 4: { label: 'L4 · Live Users', color: 'text-emerald-300 bg-emerald-950' },
};

const MATURITY_COLORS: Record<Maturity, string> = {
 Prototype: 'text-gray-400 border-gray-700',
 Experimental: 'text-blue-400 border-blue-800',
 Beta: 'text-amber-400 border-amber-800',
 Production: 'text-green-400 border-green-800',
 Certified: 'text-emerald-400 border-emerald-700',
};

// ─── Real health ping engine ──────────────────────────────────────────────────
//
// Connectors at L1 (Mock/Prototype) have no real endpoint to ping.
// We surface this honestly as 'unknown' status instead of simulating 'healthy'.
// Connectors promoted to L3+ must provide a real health endpoint URL.

const CONNECTOR_PING_URLS: Record<string, string> = {
  // L3+ connectors: add real health endpoint URLs here when OAuth is configured
  // 'google_calendar': 'https://www.googleapis.com/calendar/v3/colors',
  // 'gmail': 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
  // 'slack': 'https://slack.com/api/api.test',
};

async function pingConnector(id: string): Promise<{ status: HealthStatus; latencyMs: number; lastFailure: string | null }> {
  const url = CONNECTOR_PING_URLS[id];
  if (!url) {
    // Connector has no real endpoint configured — report honestly
    return { status: 'unknown', latencyMs: 0, lastFailure: null };
  }

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - start);
    const status: HealthStatus = response.ok || response.type === 'opaque' ? 'healthy' : 'degraded';
    return { status, latencyMs, lastFailure: null };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    if (err?.name === 'AbortError') {
      return { status: 'degraded', latencyMs, lastFailure: 'Ping timeout (>3s)' };
    }
    return { status: 'offline', latencyMs, lastFailure: `Error: ${err?.message ?? 'Unknown'}` };
  }
}

function useConnectorHealth(): ConnectorHealth[] {
  const [data, setData] = useState<ConnectorHealth[]>(() =>
    // Initial state: all connectors shown as 'unknown' until first ping completes
    CONNECTOR_REGISTRY.map(c => ({
      ...c,
      status: 'unknown' as HealthStatus,
      latencyMs: 0,
      successRate: 0,
      failureRate: 0,
      lastFailure: null,
    }))
  );

  useEffect(() => {
    let cancelled = false;

    const runPings = async () => {
      const results = await Promise.all(
        CONNECTOR_REGISTRY.map(async (c) => {
          const ping = await pingConnector(c.id);
          return {
            ...c,
            status: ping.status,
            latencyMs: ping.latencyMs,
            // successRate/failureRate require persistent tracking — set to 0 until Supabase metrics available
            successRate: ping.status === 'healthy' ? 100 : ping.status === 'degraded' ? 50 : 0,
            failureRate: ping.status === 'healthy' ? 0 : ping.status === 'degraded' ? 50 : 100,
            lastFailure: ping.lastFailure,
          };
        })
      );
      if (!cancelled) setData(results);
    };

    runPings();
    const id = setInterval(runPings, 30_000); // Re-ping every 30s (not 10s to avoid rate limits)
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_META: Record<HealthStatus, { label: string; color: string }> = {
  healthy:  { label: 'Healthy',       color: 'text-green-400' },
  degraded: { label: 'Degraded',      color: 'text-amber-400' },
  offline:  { label: 'Offline',       color: 'text-red-400'   },
  unknown:  { label: 'Not Connected', color: 'text-gray-500'  },
};

const StatusDot: React.FC<{ status: HealthStatus }> = ({ status }) => {
  if (status === 'healthy')  return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
  if (status === 'degraded') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  if (status === 'offline')  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Clock className="w-3.5 h-3.5 text-gray-500" />;
};

const ReadinessBar: React.FC<ReadinessArea> = ({ label, score, note }) => {
 const color = score >= 90 ? 'from-green-600 to-green-400'
 : score >= 60 ? 'from-amber-600 to-amber-400'
 : 'from-red-700 to-red-500';
 return (
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-label text-gray-300">{label}</span>
 <span className={`text-label font-mono font-bold ${score >= 90 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
 {score}%
 </span>
 </div>
 <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-0.5">
 <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
 </div>
 <p className="text-[10px] text-gray-600">{note}</p>
 </div>
 );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ConnectorHealthDashboard: React.FC = () => {
 const connectors = useConnectorHealth();
 const [now, setNow] = useState(new Date());
 useEffect(() => { const id = setInterval(() => setNow(new Date()), 10_000); return () => clearInterval(id); }, []);

 const healthy = connectors.filter(c => c.status === 'healthy').length;
 const degraded = connectors.filter(c => c.status === 'degraded').length;
 const offline = connectors.filter(c => c.status === 'offline').length;
 const overallScore = Math.round(READINESS_AREAS.reduce((s, a) => s + a.score, 0) / READINESS_AREAS.length);

 return (
 <div className="min-h-screen bg-[#0a0a0f] text-white p-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
 <div className="max-w-5xl mx-auto space-y-6">

 {/* Header */}
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Activity className="w-5 h-5 text-purple-400" />
 <h1 className="text-workspace font-bold">Connector Health Dashboard</h1>
 </div>
  <p className="text-label text-gray-500">CHATR Platform v0.9 RC · ABI Frozen · Connectors: <span className="text-amber-400">L1 Prototype</span> — OAuth not yet configured</p>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-1.5 text-label text-gray-500 justify-end">
 <RefreshCw className="w-3 h-3" />
 {now.toLocaleTimeString()}
 </div>
 <div className="flex items-center gap-1.5 mt-1 text-label text-amber-400 justify-end">
 <Shield className="w-3 h-3" />
 Production Readiness: {overallScore}%
 </div>
 </div>
 </div>

 {/* Two-column layout: connector table + readiness sidebar */}
 <div className="grid grid-cols-[1fr_240px] gap-6">

 {/* Left: connectors */}
 <div className="space-y-4">
 {/* Summary pills */}
 <div className="flex gap-3">
 {[
 { label: 'Healthy', count: healthy, border: 'border-green-800', text: 'text-green-400' },
 { label: 'Degraded', count: degraded, border: 'border-amber-800', text: 'text-amber-400' },
 { label: 'Offline', count: offline, border: 'border-red-900', text: 'text-red-400' },
 ].map(({ label, count, border, text }) => (
 <div key={label} className={`flex items-center gap-2 bg-gray-900 border ${border} rounded-lg px-3 py-1.5`}>
 <span className={`text-body font-bold ${text}`}>{count}</span>
 <span className="text-label text-gray-400">{label}</span>
 </div>
 ))}
 </div>

 {/* Connector rows */}
 <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
 {/* Column headers */}
 <div className="grid grid-cols-[1fr_90px_75px_90px_110px] px-4 py-2.5 border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
 <span>Connector</span>
 <span className="text-center">Status</span>
 <span className="text-center">Latency</span>
 <span className="text-center">Success</span>
 <span className="text-center">Maturity</span>
 </div>

 {connectors.map((c, i) => (
 <div
 key={c.id}
 className={`grid grid-cols-[1fr_90px_75px_90px_110px] px-4 py-3.5 items-center transition-colors hover:bg-gray-800/40 ${i < connectors.length - 1 ? 'border-b border-gray-800/60' : ''}`}
 >
 {/* Name */}
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-secondary font-medium text-white">{c.name}</span>
 <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${REALITY_LABELS[c.realityLevel].color}`}>
 {REALITY_LABELS[c.realityLevel].label}
 </span>
 </div>
 <div className="flex flex-wrap gap-1">
 {c.capabilities.map(cap => (
 <span key={cap} className="text-[9px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded font-mono">{cap}</span>
 ))}
 </div>
 </div>

 {/* Status */}
  <div className="flex items-center justify-center gap-1.5">
    <StatusDot status={c.status} />
    <span className={`text-[11px] ${STATUS_META[c.status].color}`}>
      {STATUS_META[c.status].label}
    </span>
  </div>

 {/* Latency */}
 <div className="text-center font-mono text-label text-gray-300">{c.latencyMs}ms</div>

 {/* Success */}
 <div className="text-center">
 <span className={`font-mono text-label ${c.successRate >= 95 ? 'text-green-400' : 'text-amber-400'}`}>{c.successRate}%</span>
 {c.lastFailure && <div className="text-[9px] text-gray-600 mt-0.5">{c.lastFailure}</div>}
 </div>

 {/* Maturity */}
 <div className="flex justify-center">
 <span className={`text-[10px] font-semibold border rounded px-2 py-0.5 ${MATURITY_COLORS[c.maturity]}`}>
 {c.maturity}
 </span>
 </div>
 </div>
 ))}
 </div>

 {/* Maturity legend */}
 <div className="flex items-center gap-2 text-[10px] text-gray-600">
 <span>Maturity path:</span>
 {(['Prototype', 'Experimental', 'Beta', 'Production', 'Certified'] as Maturity[]).map((m, i, arr) => (
 <span key={m} className="flex items-center gap-1">
 <span className={MATURITY_COLORS[m].split(' ')[0]}>{m}</span>
 {i < arr.length - 1 && <span className="text-gray-700">→</span>}
 </span>
 ))}
 </div>
 </div>

 {/* Right: Production Readiness */}
 <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 self-start">
 <div className="flex items-center justify-between">
 <h2 className="text-label font-semibold text-gray-300 uppercase tracking-wider">Readiness</h2>
 <span className={`text-body font-bold ${overallScore >= 80 ? 'text-green-400' : 'text-amber-400'}`}>{overallScore}%</span>
 </div>
 <div className="space-y-4">
 {READINESS_AREAS.map(a => <ReadinessBar key={a.label} {...a} />)}
 </div>
 <div className="pt-3 border-t border-gray-800">
 <div className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-wider">v1.0 Gate</div>
 {[
 'Real provider discovery (L3)',
 'Real authentication (L3)',
 'Real transaction (L3)',
 'Real verification (L3)',
 'P99 latency <500ms',
 ].map(item => (
 <div key={item} className="flex items-center gap-1.5 mb-1">
 <div className="w-3 h-3 border border-gray-700 rounded-sm shrink-0" />
 <span className="text-[10px] text-gray-500">{item}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};
