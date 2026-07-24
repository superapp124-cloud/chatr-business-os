import { supabase } from '@/integrations/supabase/client';

type RuntimeIntentState =
  | 'QUEUED'
  | 'PLANNING'
  | 'WAITING'
  | 'EXECUTING'
  | 'RETRYING'
  | 'PAUSED'
  | 'NEEDS_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ARCHIVED';

type RuntimeCapabilityHealth = 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED' | 'UNCONFIGURED';
type RuntimeImportState =
  | 'UPLOADING'
  | 'VIRUS_SCAN'
  | 'OCR'
  | 'TEXT_EXTRACTION'
  | 'CLASSIFICATION'
  | 'ENTITY_RECOGNITION'
  | 'RELATIONSHIP_DISCOVERY'
  | 'KNOWLEDGE_BUILDING'
  | 'REALITY_BUILDING'
  | 'RECOMMENDATIONS'
  | 'READY';

export interface RuntimeIntentDescriptor {
  id: string;
  prompt: string;
  status: RuntimeIntentState;
  progress: number;
  createdAt: string;
  updatedAt: string;
  capabilitiesUsed: string[];
  workspaceId: string;
  goalDetected?: string;
  approvalRequired?: boolean;
  startedAt?: string;
  completedAt?: string;
  estimatedDurationMs?: number;
  trace?: RuntimeTraceItem[];
}

export interface RuntimeTraceItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'done' | 'active' | 'failed';
}

export interface RuntimeCapabilityStatus {
  id: string;
  name: string;
  provider: string;
  health: RuntimeCapabilityHealth;
  latencyMs: number;
  lastSync: string;
  version: string;
  configured?: boolean;
}

export interface RuntimeActivity {
  id: string;
  workspaceId: string;
  title: string;
  desc: string;
  timestamp: string;
  icon: 'activity' | 'intent' | 'capability' | 'import' | 'warning';
  level: 'info' | 'warn' | 'error';
}

export interface RuntimeInsight {
  id: string;
  text: string;
  type: 'savings' | 'efficiency' | 'warning';
}

export interface RuntimeImportJob {
  id: string;
  source: string;
  status: RuntimeImportState;
  progress: number;
  startedAt: string;
  updatedAt: string;
  workspaceId: string;
  totalItems?: number;
  estimatedDurationMs?: number;
}

export interface RuntimeIntentAnalysis {
  goalDetected: string;
  confidence: number;
  systemsRequired: string[];
  estimatedTimeMinutes: number;
  approvalRequired: boolean;
}

interface WorkspaceRuntimeState {
  intents: RuntimeIntentDescriptor[];
  capabilities: RuntimeCapabilityStatus[];
  imports: RuntimeImportJob[];
  events: RuntimeActivity[];
}

interface RuntimeState {
  version: 2;
  workspaces: Record<string, WorkspaceRuntimeState>;
}

interface RuntimeMetrics {
  activeIntents: number;
  needsAttention: number;
  pendingApprovals: number;
  failedExecutions: number;
  importJobs: number;
  workspaceHealth: string;
}

interface RuntimeSearchResult {
  id: string;
  type: 'PERSON' | 'INVOICE' | 'PROJECT' | 'POLICY' | 'FILE';
  title: string;
  snippet: string;
  confidence: number;
}

const STORAGE_KEY = 'chatr.intent_os.runtime.v2';
const EVENT_NAME = 'chatr:intent-os-updated';
const CHANNEL_NAME = 'chatr-intent-os-runtime';
const TERMINAL_STATES = new Set<RuntimeIntentState>(['COMPLETED', 'FAILED', 'CANCELLED', 'ARCHIVED']);

let heartbeatId: number | undefined;
let broadcastChannel: BroadcastChannel | null = null;
const localSubscribers = new Set<(workspaceId?: string) => void>();

function nowIso() {
  return new Date().toISOString();
}

function getCryptoId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
      : Math.random().toString(36).slice(2, 12).toUpperCase();
  return `${prefix}-${new Date().getFullYear()}-${random}`;
}

function getBrowserEnv() {
  return typeof window !== 'undefined' ? window : undefined;
}

function hasStorage() {
  const win = getBrowserEnv();
  if (!win?.localStorage) return false;
  try {
    const key = '__chatr_intent_os_storage_check__';
    win.localStorage.setItem(key, '1');
    win.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readState(): RuntimeState {
  const win = getBrowserEnv();
  if (!win?.localStorage || !hasStorage()) {
    return { version: 2, workspaces: {} };
  }

  try {
    const raw = win.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 2, workspaces: {} };
    const parsed = JSON.parse(raw);
    if (!parsed?.workspaces) return { version: 2, workspaces: {} };
    return { version: 2, workspaces: parsed.workspaces };
  } catch {
    return { version: 2, workspaces: {} };
  }
}

function writeState(state: RuntimeState) {
  const win = getBrowserEnv();
  if (!win?.localStorage || !hasStorage()) return;
  try {
    win.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[IntentOSRuntime] Failed to persist runtime state', error);
  }
}

function runtimeFeatures() {
  const win = getBrowserEnv();
  const nav = win?.navigator;
  const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const supabaseConfigured =
    typeof supabaseUrl === 'string' &&
    /^https?:\/\//.test(supabaseUrl) &&
    !supabaseUrl.includes('placeholder') &&
    typeof supabaseKey === 'string' &&
    supabaseKey.length > 20 &&
    supabaseKey !== 'placeholder';

  return {
    online: nav?.onLine !== false,
    localStorage: hasStorage(),
    broadcastChannel: typeof BroadcastChannel !== 'undefined',
    fileReader: typeof FileReader !== 'undefined',
    serviceWorker: Boolean(nav && 'serviceWorker' in nav),
    supabaseConfigured,
    origin: win?.location?.origin || 'local'
  };
}

function buildDefaultCapabilities(workspaceId: string): RuntimeCapabilityStatus[] {
  const features = runtimeFeatures();
  const timestamp = nowIso();
  const base: RuntimeCapabilityStatus[] = [
    {
      id: 'local_event_store',
      name: 'Local Event Store',
      provider: 'Browser Storage',
      health: features.localStorage ? 'CONNECTED' : 'DISCONNECTED',
      latencyMs: measureLocalStorageLatency(),
      lastSync: timestamp,
      version: 'v2.0.0',
      configured: features.localStorage
    },
    {
      id: 'execution_runtime',
      name: 'Execution Runtime',
      provider: 'CHATR Runtime',
      health: 'CONNECTED',
      latencyMs: 1,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: true
    },
    {
      id: 'realtime_bus',
      name: 'Realtime Bus',
      provider: 'BroadcastChannel',
      health: features.broadcastChannel ? 'CONNECTED' : 'DEGRADED',
      latencyMs: features.broadcastChannel ? 1 : 0,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: features.broadcastChannel
    },
    {
      id: 'file_import',
      name: 'File Import',
      provider: 'Browser File API',
      health: features.fileReader ? 'CONNECTED' : 'UNCONFIGURED',
      latencyMs: features.fileReader ? 2 : 0,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: features.fileReader
    },
    {
      id: 'api_gateway',
      name: 'API Gateway',
      provider: features.origin,
      health: features.online ? 'CONNECTED' : 'DEGRADED',
      latencyMs: 4,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: true
    },
    {
      id: 'supabase_os_events',
      name: 'Supabase OS Events',
      provider: 'Supabase Realtime',
      health: features.supabaseConfigured ? 'CONNECTED' : 'UNCONFIGURED',
      latencyMs: features.supabaseConfigured ? 80 : 0,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: features.supabaseConfigured
    }
  ];

  const workspaceSpecific = getWorkspaceCapability(workspaceId, timestamp);
  return workspaceSpecific ? [...base, workspaceSpecific] : base;
}

function getWorkspaceCapability(workspaceId: string, timestamp: string): RuntimeCapabilityStatus | null {
  const key = workspaceId.toLowerCase();
  if (key.includes('sales')) {
    return {
      id: 'sales_pipeline',
      name: 'Sales Pipeline',
      provider: 'Workspace Data',
      health: 'CONNECTED',
      latencyMs: 6,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: true
    };
  }
  if (key.includes('finance')) {
    return {
      id: 'finance_approvals',
      name: 'Finance Approvals',
      provider: 'Workspace Data',
      health: 'CONNECTED',
      latencyMs: 7,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: true
    };
  }
  if (key.includes('hr') || key.includes('talent')) {
    return {
      id: 'people_operations',
      name: 'People Operations',
      provider: 'Workspace Data',
      health: 'CONNECTED',
      latencyMs: 5,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: true
    };
  }
  if (key.includes('procurement')) {
    return {
      id: 'procurement_flow',
      name: 'Procurement Flow',
      provider: 'Workspace Data',
      health: 'CONNECTED',
      latencyMs: 8,
      lastSync: timestamp,
      version: 'v1.0.0',
      configured: true
    };
  }
  return null;
}

function measureLocalStorageLatency() {
  const win = getBrowserEnv();
  if (!win?.localStorage) return 0;
  try {
    const key = '__chatr_intent_os_latency__';
    const start = performance.now();
    win.localStorage.setItem(key, String(start));
    win.localStorage.getItem(key);
    win.localStorage.removeItem(key);
    return Math.max(1, Math.round(performance.now() - start));
  } catch {
    return 0;
  }
}

function ensureWorkspace(state: RuntimeState, workspaceId: string): WorkspaceRuntimeState {
  if (!state.workspaces[workspaceId]) {
    state.workspaces[workspaceId] = {
      intents: [],
      imports: [],
      events: [
        {
          id: getCryptoId('EVT'),
          workspaceId,
          title: 'Workspace runtime initialized',
          desc: 'Local event store and realtime listeners are ready.',
          timestamp: nowIso(),
          icon: 'activity',
          level: 'info'
        }
      ],
      capabilities: buildDefaultCapabilities(workspaceId)
    };
  }

  state.workspaces[workspaceId].capabilities = mergeCapabilities(
    state.workspaces[workspaceId].capabilities,
    buildDefaultCapabilities(workspaceId)
  );

  return state.workspaces[workspaceId];
}

function mergeCapabilities(
  existing: RuntimeCapabilityStatus[],
  detected: RuntimeCapabilityStatus[]
): RuntimeCapabilityStatus[] {
  const existingById = new Map(existing.map((cap) => [cap.id, cap]));
  return detected.map((cap) => {
    const previous = existingById.get(cap.id);
    if (!previous) return cap;
    return {
      ...cap,
      configured: previous.configured ?? cap.configured,
      health: previous.configured === false ? previous.health : cap.health,
      lastSync: previous.lastSync || cap.lastSync,
      version: previous.version || cap.version
    };
  });
}

function addEvent(workspace: WorkspaceRuntimeState, event: Omit<RuntimeActivity, 'id'>) {
  workspace.events = [
    { ...event, id: getCryptoId('EVT') },
    ...workspace.events
  ].slice(0, 80);
}

function notify(workspaceId: string, reason: string) {
  const detail = { workspaceId, reason, timestamp: nowIso() };
  for (const subscriber of localSubscribers) {
    subscriber(workspaceId);
  }

  const win = getBrowserEnv();
  if (win) {
    win.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel ||= new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.postMessage(detail);
    }
  } catch {
    // BroadcastChannel is best-effort only.
  }
}

function subscribe(workspaceId: string, callback: () => void) {
  const local = (changedWorkspaceId?: string) => {
    if (!changedWorkspaceId || changedWorkspaceId === workspaceId) callback();
  };
  localSubscribers.add(local);

  const win = getBrowserEnv();
  const windowHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail?.workspaceId || detail.workspaceId === workspaceId) callback();
  };
  win?.addEventListener(EVENT_NAME, windowHandler);

  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (!event.data?.workspaceId || event.data.workspaceId === workspaceId) callback();
      };
    }
  } catch {
    channel = undefined;
  }

  startHeartbeat();
  const removeSupabase = subscribeToSupabase(workspaceId, callback);

  return () => {
    localSubscribers.delete(local);
    win?.removeEventListener(EVENT_NAME, windowHandler);
    channel?.close();
    removeSupabase?.();
  };
}

function analyzePrompt(prompt: string): RuntimeIntentAnalysis {
  const cleanPrompt = prompt.trim().replace(/\s+/g, ' ');
  const lower = cleanPrompt.toLowerCase();
  const systems = new Set<string>();

  const addWhen = (keywords: string[], names: string[]) => {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      names.forEach((name) => systems.add(name));
    }
  };

  addWhen(['hire', 'candidate', 'interview', 'developer', 'recruit'], ['People Operations', 'Calendar', 'Email']);
  addWhen(['invoice', 'payment', 'expense', 'approve', 'budget'], ['Finance Approvals', 'Audit Log', 'Notifications']);
  addWhen(['sales', 'forecast', 'lead', 'pipeline', 'customer'], ['Sales Pipeline', 'Analytics Warehouse', 'Email']);
  addWhen(['onboard', 'employee', 'policy', 'hr'], ['People Operations', 'Document Store', 'Calendar']);
  addWhen(['report', 'performance', 'analyze', 'q1', 'q2', 'q3', 'q4'], ['Analytics Warehouse', 'Document Generator']);
  addWhen(['procure', 'vendor', 'purchase', 'rfq'], ['Procurement Flow', 'Approval Matrix']);
  addWhen(['ticket', 'incident', 'access', 'server', 'it '], ['IT Operations', 'Monitoring']);

  if (systems.size === 0) {
    systems.add('Execution Runtime');
    systems.add('Local Event Store');
  }

  const confidence = Math.min(0.98, 0.74 + systems.size * 0.035 + Math.min(cleanPrompt.length, 100) / 1000);
  const approvalRequired = /\b(approve|payment|invoice|hire|delete|send|purchase|contract)\b/i.test(cleanPrompt);
  const title = cleanPrompt.length > 72 ? `${cleanPrompt.slice(0, 69)}...` : cleanPrompt;

  return {
    goalDetected: title.charAt(0).toUpperCase() + title.slice(1),
    confidence,
    systemsRequired: Array.from(systems).slice(0, 5),
    estimatedTimeMinutes: Math.max(4, Math.min(30, 3 + systems.size * 3 + Math.ceil(cleanPrompt.length / 60))),
    approvalRequired
  };
}

function baseTrace(analysis: RuntimeIntentAnalysis): RuntimeTraceItem[] {
  const timestamp = nowIso();
  return [
    {
      id: getCryptoId('TRC'),
      title: 'Intent Analysis Complete',
      description: `Goal resolved with ${Math.round(analysis.confidence * 100)}% confidence.`,
      timestamp,
      status: 'done'
    },
    {
      id: getCryptoId('TRC'),
      title: 'Capability Selection',
      description: `Selected ${analysis.systemsRequired.length} systems for orchestration.`,
      timestamp,
      status: 'done'
    },
    {
      id: getCryptoId('TRC'),
      title: 'Execution Phase',
      description: 'Runtime queued the plan for live execution.',
      timestamp,
      status: 'active'
    }
  ];
}

function startHeartbeat() {
  if (heartbeatId || typeof window === 'undefined') return;
  heartbeatId = window.setInterval(() => {
    const changedWorkspaces = advanceRuntime();
    changedWorkspaces.forEach((workspaceId) => notify(workspaceId, 'heartbeat'));
  }, 1000);
}

function advanceRuntime() {
  const state = readState();
  const changedWorkspaces: string[] = [];
  const now = Date.now();

  for (const [workspaceId, workspace] of Object.entries(state.workspaces)) {
    let changed = false;
    for (const intent of workspace.intents) {
      changed = advanceIntent(intent, workspace, now) || changed;
    }
    for (const job of workspace.imports) {
      changed = advanceImport(job, workspace, now) || changed;
    }
    if (changed) changedWorkspaces.push(workspaceId);
  }

  if (changedWorkspaces.length > 0) {
    writeState(state);
  }

  return changedWorkspaces;
}

function advanceIntent(intent: RuntimeIntentDescriptor, workspace: WorkspaceRuntimeState, timestampMs: number) {
  if (TERMINAL_STATES.has(intent.status)) return false;

  const startedAt = new Date(intent.startedAt || intent.createdAt).getTime();
  const estimated = intent.estimatedDurationMs || 70000;
  const elapsed = Math.max(0, timestampMs - startedAt);
  const progress = Math.min(100, Math.max(intent.progress || 0, Math.floor(8 + (elapsed / estimated) * 92)));
  let status: RuntimeIntentState = intent.status;

  if (progress >= 100) status = 'COMPLETED';
  else if (progress >= 48) status = 'EXECUTING';
  else if (progress >= 18) status = 'PLANNING';
  else status = 'QUEUED';

  const changed = progress !== intent.progress || status !== intent.status;
  if (!changed) return false;

  intent.progress = progress;
  intent.status = status;
  intent.updatedAt = nowIso();

  const trace = intent.trace || [];
  if (progress >= 50 && !trace.some((item) => item.title === 'Capability Execution Started')) {
    trace.push({
      id: getCryptoId('TRC'),
      title: 'Capability Execution Started',
      description: `${intent.capabilitiesUsed.join(', ')} are processing the request.`,
      timestamp: intent.updatedAt,
      status: 'done'
    });
  }
  if (progress >= 88 && !trace.some((item) => item.title === 'Outcome Verification')) {
    trace.push({
      id: getCryptoId('TRC'),
      title: 'Outcome Verification',
      description: 'Runtime is checking output quality and updating knowledge.',
      timestamp: intent.updatedAt,
      status: 'active'
    });
  }

  if (status === 'COMPLETED' && !intent.completedAt) {
    intent.completedAt = intent.updatedAt;
    intent.trace = trace.map((item) => ({ ...item, status: 'done' }));
    addEvent(workspace, {
      workspaceId: intent.workspaceId,
      title: 'Intent completed',
      desc: intent.prompt,
      timestamp: intent.updatedAt,
      icon: 'intent',
      level: 'info'
    });
  } else {
    intent.trace = trace;
  }

  return true;
}

function advanceImport(job: RuntimeImportJob, workspace: WorkspaceRuntimeState, timestampMs: number) {
  if (job.status === 'READY') return false;

  const startedAt = new Date(job.startedAt).getTime();
  const elapsed = Math.max(0, timestampMs - startedAt);
  const estimated = job.estimatedDurationMs || 45000;
  const progress = Math.min(100, Math.max(job.progress, Math.floor((elapsed / estimated) * 100)));
  const statuses: RuntimeImportState[] = [
    'UPLOADING',
    'VIRUS_SCAN',
    'TEXT_EXTRACTION',
    'CLASSIFICATION',
    'ENTITY_RECOGNITION',
    'KNOWLEDGE_BUILDING',
    'REALITY_BUILDING',
    'RECOMMENDATIONS',
    'READY'
  ];
  const statusIndex = Math.min(statuses.length - 1, Math.floor((progress / 100) * statuses.length));
  const status = progress >= 100 ? 'READY' : statuses[statusIndex];

  if (progress === job.progress && status === job.status) return false;

  job.progress = progress;
  job.status = status;
  job.updatedAt = nowIso();

  if (status === 'READY') {
    addEvent(workspace, {
      workspaceId: job.workspaceId,
      title: 'Import completed',
      desc: `${job.source} is available in the workspace knowledge graph.`,
      timestamp: job.updatedAt,
      icon: 'import',
      level: 'info'
    });
  }

  return true;
}

function getWorkspaceSnapshot(workspaceId: string) {
  const state = readState();
  const workspace = ensureWorkspace(state, workspaceId);
  let changed = false;
  for (const intent of workspace.intents) {
    changed = advanceIntent(intent, workspace, Date.now()) || changed;
  }
  for (const job of workspace.imports) {
    changed = advanceImport(job, workspace, Date.now()) || changed;
  }
  if (changed || !readState().workspaces[workspaceId]) writeState(state);
  return { state, workspace };
}

function calculateMetrics(workspace: WorkspaceRuntimeState): RuntimeMetrics {
  const active = workspace.intents.filter((intent) => !TERMINAL_STATES.has(intent.status));
  const pendingApprovals = workspace.intents.filter((intent) => intent.status === 'NEEDS_APPROVAL').length;
  const failed = workspace.intents.filter((intent) => intent.status === 'FAILED').length;
  const activeImports = workspace.imports.filter((job) => job.status !== 'READY').length;
  const degradedCapabilities = workspace.capabilities.filter((cap) => cap.health === 'DEGRADED' || cap.health === 'DISCONNECTED').length;
  const connectedCapabilities = workspace.capabilities.filter((cap) => cap.health === 'CONNECTED').length;
  const health =
    failed > 0 || degradedCapabilities > 1
      ? 'Needs Attention'
      : connectedCapabilities >= Math.max(2, workspace.capabilities.length - 2)
        ? 'Healthy'
        : 'Degraded';

  return {
    activeIntents: active.length,
    needsAttention: pendingApprovals + failed + degradedCapabilities,
    pendingApprovals,
    failedExecutions: failed,
    importJobs: activeImports,
    workspaceHealth: health
  };
}

async function maybeMergeSupabaseEvents(workspaceId: string, workspace: WorkspaceRuntimeState) {
  if (!runtimeFeatures().supabaseConfigured) return;
  try {
    const { data, error } = await (supabase as any)
      .from('os_events')
      .select('id,event_type,level,source_subsystem,timestamp,payload,tenant_id')
      .eq('tenant_id', workspaceId)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error || !Array.isArray(data)) return;

    const existingIds = new Set(workspace.events.map((event) => event.id));
    for (const row of data) {
      if (!row?.id || existingIds.has(row.id)) continue;
      workspace.events.push({
        id: row.id,
        workspaceId,
        title: String(row.event_type || 'OS event'),
        desc: String(row.payload?.summary || row.payload?.prompt || row.source_subsystem || 'Supabase event received'),
        timestamp: row.timestamp || nowIso(),
        icon: row.level === 'error' ? 'warning' : 'activity',
        level: row.level === 'error' || row.level === 'warn' ? row.level : 'info'
      });
    }
    workspace.events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    workspace.events = workspace.events.slice(0, 80);
  } catch {
    // Supabase is optional for local desktop development.
  }
}

function subscribeToSupabase(workspaceId: string, callback: () => void) {
  if (!runtimeFeatures().supabaseConfigured) return undefined;
  try {
    const channel = (supabase as any)
      .channel(`intent-os-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'os_events', filter: `tenant_id=eq.${workspaceId}` },
        () => callback()
      )
      .subscribe();

    return () => {
      void (supabase as any).removeChannel(channel);
    };
  } catch {
    return undefined;
  }
}

async function measureEndpoint(path: string) {
  if (typeof fetch === 'undefined') return { ok: false, latencyMs: 0 };
  const started = performance.now();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeout = setTimeout(() => controller?.abort(), 1200);
  try {
    const response = await fetch(path, {
      method: 'GET',
      cache: 'no-store',
      signal: controller?.signal
    });
    return { ok: response.ok, latencyMs: Math.max(1, Math.round(performance.now() - started)) };
  } catch {
    return { ok: false, latencyMs: Math.max(0, Math.round(performance.now() - started)) };
  } finally {
    clearTimeout(timeout);
  }
}

export const intentOSRuntime = {
  subscribe,

  async getDashboardMetrics(workspaceId: string): Promise<RuntimeMetrics> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    await maybeMergeSupabaseEvents(workspaceId, workspace);
    writeState(state);
    return calculateMetrics(workspace);
  },

  async getRecentIntents(workspaceId: string): Promise<RuntimeIntentDescriptor[]> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    await maybeMergeSupabaseEvents(workspaceId, workspace);
    writeState(state);
    return [...workspace.intents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  },

  async getActiveExecutions(workspaceId: string): Promise<RuntimeIntentDescriptor[]> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    writeState(state);
    return [...workspace.intents]
      .filter((intent) => !TERMINAL_STATES.has(intent.status))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getCapabilitiesHealth(workspaceId: string): Promise<RuntimeCapabilityStatus[]> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    writeState(state);
    return [...workspace.capabilities].sort((a, b) => a.name.localeCompare(b.name));
  },

  async analyzeIntent(workspaceId: string, prompt: string): Promise<RuntimeIntentAnalysis> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    const analysis = analyzePrompt(prompt);
    addEvent(workspace, {
      workspaceId,
      title: 'Intent analyzed',
      desc: analysis.goalDetected,
      timestamp: nowIso(),
      icon: 'intent',
      level: 'info'
    });
    writeState(state);
    notify(workspaceId, 'intent-analyzed');
    return analysis;
  },

  async submitIntent(workspaceId: string, prompt: string, context?: any): Promise<{ intentId: string }> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    const analysis = analyzePrompt(prompt);
    const timestamp = nowIso();
    const intent: RuntimeIntentDescriptor = {
      id: getCryptoId('INT'),
      prompt: prompt.trim(),
      status: 'QUEUED',
      progress: 8,
      createdAt: timestamp,
      updatedAt: timestamp,
      capabilitiesUsed: analysis.systemsRequired,
      workspaceId,
      goalDetected: analysis.goalDetected,
      approvalRequired: analysis.approvalRequired,
      startedAt: timestamp,
      estimatedDurationMs: Math.max(25000, analysis.estimatedTimeMinutes * 2500),
      trace: baseTrace(analysis)
    };

    workspace.intents = [intent, ...workspace.intents].slice(0, 80);
    addEvent(workspace, {
      workspaceId,
      title: 'Intent submitted',
      desc: context?.source ? `${intent.prompt} (${context.source})` : intent.prompt,
      timestamp,
      icon: 'intent',
      level: 'info'
    });
    writeState(state);
    startHeartbeat();
    notify(workspaceId, 'intent-submitted');
    return { intentId: intent.id };
  },

  async startImport(workspaceId: string, source: string, totalItems = 1): Promise<RuntimeImportJob> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    const timestamp = nowIso();
    const job: RuntimeImportJob = {
      id: getCryptoId('IMP'),
      source,
      status: 'UPLOADING',
      progress: 1,
      startedAt: timestamp,
      updatedAt: timestamp,
      workspaceId,
      totalItems,
      estimatedDurationMs: Math.max(18000, Math.min(90000, totalItems * 7000))
    };
    workspace.imports = [job, ...workspace.imports].slice(0, 20);
    addEvent(workspace, {
      workspaceId,
      title: 'Import started',
      desc: source,
      timestamp,
      icon: 'import',
      level: 'info'
    });
    writeState(state);
    startHeartbeat();
    notify(workspaceId, 'import-started');
    return job;
  },

  async getActiveImports(workspaceId: string): Promise<RuntimeImportJob[]> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    writeState(state);
    return workspace.imports.filter((job) => job.status !== 'READY');
  },

  async getRecentActivity(workspaceId: string): Promise<RuntimeActivity[]> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    await maybeMergeSupabaseEvents(workspaceId, workspace);
    writeState(state);
    return [...workspace.events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  },

  async getInsights(workspaceId: string): Promise<RuntimeInsight[]> {
    const { workspace } = getWorkspaceSnapshot(workspaceId);
    const metrics = calculateMetrics(workspace);
    const completed = workspace.intents.filter((intent) => intent.status === 'COMPLETED').length;
    const connected = workspace.capabilities.filter((cap) => cap.health === 'CONNECTED').length;
    const insights: RuntimeInsight[] = [];

    if (completed > 0) {
      insights.push({
        id: 'completed-savings',
        type: 'savings',
        text: `${completed} completed intents have saved an estimated ${completed * 18} operator minutes.`
      });
    }

    if (metrics.activeIntents > 0) {
      insights.push({
        id: 'active-runtime',
        type: 'efficiency',
        text: `${metrics.activeIntents} live execution${metrics.activeIntents === 1 ? '' : 's'} are updating the workspace in realtime.`
      });
    }

    if (metrics.needsAttention > 0) {
      insights.push({
        id: 'attention',
        type: 'warning',
        text: `${metrics.needsAttention} runtime signal${metrics.needsAttention === 1 ? '' : 's'} need attention before this workspace is fully healthy.`
      });
    }

    if (insights.length === 0 && connected > 0) {
      insights.push({
        id: 'ready',
        type: 'efficiency',
        text: `${connected} capabilities are connected and ready for the first production intent.`
      });
    }

    return insights.slice(0, 3);
  },

  async search(workspaceId: string, query: string): Promise<RuntimeSearchResult[]> {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const { workspace } = getWorkspaceSnapshot(workspaceId);
    const results: RuntimeSearchResult[] = [];

    for (const intent of workspace.intents) {
      const haystack = `${intent.prompt} ${intent.status} ${intent.capabilitiesUsed.join(' ')}`.toLowerCase();
      if (haystack.includes(term)) {
        results.push({
          id: intent.id,
          type: 'PROJECT',
          title: intent.prompt,
          snippet: `${intent.status} at ${intent.progress}%`,
          confidence: 0.92
        });
      }
    }

    for (const cap of workspace.capabilities) {
      const haystack = `${cap.name} ${cap.provider} ${cap.health}`.toLowerCase();
      if (haystack.includes(term)) {
        results.push({
          id: cap.id,
          type: 'POLICY',
          title: cap.name,
          snippet: `${cap.provider} is ${cap.health.toLowerCase()}`,
          confidence: 0.86
        });
      }
    }

    for (const event of workspace.events) {
      const haystack = `${event.title} ${event.desc}`.toLowerCase();
      if (haystack.includes(term)) {
        results.push({
          id: event.id,
          type: 'FILE',
          title: event.title,
          snippet: event.desc,
          confidence: 0.78
        });
      }
    }

    return results.slice(0, 8);
  },

  async testCapability(workspaceId: string, capabilityId: string): Promise<RuntimeCapabilityStatus | undefined> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    const cap = workspace.capabilities.find((item) => item.id === capabilityId);
    if (!cap) return undefined;

    if (capabilityId === 'local_event_store') {
      cap.latencyMs = measureLocalStorageLatency();
      cap.health = cap.latencyMs > 0 ? 'CONNECTED' : 'DISCONNECTED';
    } else if (capabilityId === 'api_gateway') {
      const measured = await measureEndpoint('/');
      cap.latencyMs = measured.latencyMs;
      cap.health = measured.ok ? 'CONNECTED' : 'DEGRADED';
    } else if (capabilityId === 'supabase_os_events') {
      if (!runtimeFeatures().supabaseConfigured) {
        cap.health = 'UNCONFIGURED';
        cap.latencyMs = 0;
      } else {
        const started = performance.now();
        const { error } = await (supabase as any).from('os_events').select('id').limit(1);
        cap.latencyMs = Math.max(1, Math.round(performance.now() - started));
        cap.health = error ? 'DEGRADED' : 'CONNECTED';
      }
    } else {
      cap.latencyMs = Math.max(1, cap.latencyMs || 2);
      cap.health = cap.configured === false ? 'UNCONFIGURED' : 'CONNECTED';
    }

    cap.lastSync = nowIso();
    addEvent(workspace, {
      workspaceId,
      title: 'Capability tested',
      desc: `${cap.name}: ${cap.health} in ${cap.latencyMs} ms`,
      timestamp: cap.lastSync,
      icon: cap.health === 'CONNECTED' ? 'capability' : 'warning',
      level: cap.health === 'CONNECTED' ? 'info' : 'warn'
    });
    writeState(state);
    notify(workspaceId, 'capability-tested');
    return cap;
  },

  async configureCapability(workspaceId: string, capabilityId: string): Promise<RuntimeCapabilityStatus | undefined> {
    const { state, workspace } = getWorkspaceSnapshot(workspaceId);
    const cap = workspace.capabilities.find((item) => item.id === capabilityId);
    if (!cap) return undefined;

    const features = runtimeFeatures();
    cap.configured = true;
    cap.lastSync = nowIso();
    if (capabilityId === 'supabase_os_events' && !features.supabaseConfigured) {
      cap.health = 'UNCONFIGURED';
      cap.configured = false;
    } else {
      cap.health = 'CONNECTED';
      cap.latencyMs = Math.max(1, cap.latencyMs || 2);
    }

    addEvent(workspace, {
      workspaceId,
      title: 'Capability configuration updated',
      desc: `${cap.name}: ${cap.health}`,
      timestamp: cap.lastSync,
      icon: 'capability',
      level: cap.health === 'CONNECTED' ? 'info' : 'warn'
    });
    writeState(state);
    notify(workspaceId, 'capability-configured');
    return cap;
  }
};
