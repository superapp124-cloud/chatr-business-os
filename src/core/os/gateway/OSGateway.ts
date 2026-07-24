/**
 * CHATR Universal Intent OS
 * OS Gateway (Production v1.0)
 *
 * Single frontend entry point for the Studio/Intent OS runtime. It keeps the
 * stable API envelope while delegating state, progress, and realtime updates
 * to the browser-safe runtime store.
 */

import { intentOSRuntime } from './IntentOSRuntime';

export interface OSEnvelope<T = any> {
  success: boolean;
  requestId: string;
  workspaceId: string;
  correlationId: string;
  timestamp: string;
  data?: T;
  warnings: string[];
  errors: { code: string; message: string; details?: any }[];
}

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

async function executeApiCall<T>(
  operation: string,
  workspaceId: string,
  executor: () => Promise<T>
): Promise<OSEnvelope<T>> {
  const requestId = createId('req');
  const correlationId = createId('cor');

  try {
    const data = await executor();
    return {
      success: true,
      requestId,
      workspaceId,
      correlationId,
      timestamp: new Date().toISOString(),
      data,
      warnings: [],
      errors: []
    };
  } catch (error: any) {
    console.error(`[OSGateway] ${operation} failed`, error);
    return {
      success: false,
      requestId,
      workspaceId,
      correlationId,
      timestamp: new Date().toISOString(),
      warnings: [],
      errors: [
        {
          code: error?.code || 'INTERNAL_ERROR',
          message: error?.message || 'An unexpected error occurred in the OS Runtime',
          details: error?.details
        }
      ]
    };
  }
}

export enum IntentState {
  Queued = 'QUEUED',
  Planning = 'PLANNING',
  Waiting = 'WAITING',
  Executing = 'EXECUTING',
  Retrying = 'RETRYING',
  Paused = 'PAUSED',
  NeedsApproval = 'NEEDS_APPROVAL',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
  Archived = 'ARCHIVED'
}

export enum ImportState {
  Uploading = 'UPLOADING',
  VirusScan = 'VIRUS_SCAN',
  OCR = 'OCR',
  TextExtraction = 'TEXT_EXTRACTION',
  Classification = 'CLASSIFICATION',
  EntityRecognition = 'ENTITY_RECOGNITION',
  RelationshipDiscovery = 'RELATIONSHIP_DISCOVERY',
  KnowledgeBuilding = 'KNOWLEDGE_BUILDING',
  RealityBuilding = 'REALITY_BUILDING',
  Recommendations = 'RECOMMENDATIONS',
  Ready = 'READY'
}

export enum CapabilityHealth {
  Connected = 'CONNECTED',
  Disconnected = 'DISCONNECTED',
  Degraded = 'DEGRADED',
  Unconfigured = 'UNCONFIGURED'
}

export interface ExecutionTraceItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'done' | 'active' | 'failed';
}

export interface IntentDescriptor {
  id: string;
  prompt: string;
  status: IntentState;
  progress: number;
  createdAt: string;
  updatedAt: string;
  capabilitiesUsed: string[];
  workspaceId?: string;
  goalDetected?: string;
  approvalRequired?: boolean;
  trace?: ExecutionTraceItem[];
}

export interface BusinessHealthMetrics {
  activeIntents: number;
  needsAttention: number;
  pendingApprovals: number;
  failedExecutions: number;
  importJobs: number;
  workspaceHealth: string;
}

export interface CapabilityStatus {
  id: string;
  name: string;
  provider: string;
  health: CapabilityHealth;
  latencyMs: number;
  lastSync: string;
  version: string;
  configured?: boolean;
}

export interface SearchResult {
  id: string;
  type: 'PERSON' | 'INVOICE' | 'PROJECT' | 'POLICY' | 'FILE';
  title: string;
  snippet: string;
  confidence: number;
}

export interface Notification {
  id: string;
  intentId?: string;
  type: 'APPROVAL' | 'ERROR' | 'ALERT';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface ImportJob {
  id: string;
  source: string;
  status: ImportState;
  progress: number;
  startedAt: string;
  updatedAt?: string;
  workspaceId?: string;
  totalItems?: number;
}

export interface IntentAnalysis {
  goalDetected: string;
  confidence: number;
  systemsRequired: string[];
  estimatedTimeMinutes: number;
  approvalRequired: boolean;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  title: string;
  desc: string;
  timestamp: string;
  icon: 'activity' | 'intent' | 'capability' | 'import' | 'warning';
  level: 'info' | 'warn' | 'error';
}

export interface BusinessInsight {
  id: string;
  text: string;
  type: 'savings' | 'efficiency' | 'warning';
}

class HomeService {
  async getDashboardMetrics(workspaceId: string): Promise<OSEnvelope<BusinessHealthMetrics>> {
    return executeApiCall('HomeService.getDashboardMetrics', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/metrics?workspaceId=${encodeURIComponent(workspaceId)}`);
      return res.json();
    });
  }

  async getRecentIntents(workspaceId: string): Promise<OSEnvelope<IntentDescriptor[]>> {
    return executeApiCall('HomeService.getRecentIntents', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/intents/recent?workspaceId=${encodeURIComponent(workspaceId)}`);
      const payload = await res.json();
      return payload.data;
    });
  }

  async getRecentActivity(workspaceId: string): Promise<OSEnvelope<ActivityEvent[]>> {
    return executeApiCall('HomeService.getRecentActivity', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/activity?workspaceId=${encodeURIComponent(workspaceId)}`);
      const payload = await res.json();
      return payload.data;
    });
  }

  async getInsights(workspaceId: string): Promise<OSEnvelope<BusinessInsight[]>> {
    return executeApiCall('HomeService.getInsights', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/insights?workspaceId=${encodeURIComponent(workspaceId)}`);
      const payload = await res.json();
      return payload.data;
    });
  }
}

class WatchService {
  async getActiveExecutions(workspaceId: string): Promise<OSEnvelope<IntentDescriptor[]>> {
    return executeApiCall('WatchService.getActiveExecutions', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/watch/active?workspaceId=${encodeURIComponent(workspaceId)}`);
      const payload = await res.json();
      return payload.data;
    });
  }

  async getInbox(workspaceId: string): Promise<OSEnvelope<Notification[]>> {
    return executeApiCall('WatchService.getInbox', workspaceId, async () => []);
  }
}

class IntentService {
  async analyzeIntent(workspaceId: string, prompt: string): Promise<OSEnvelope<IntentAnalysis>> {
    return executeApiCall('IntentService.analyzeIntent', workspaceId, async () => {
      // Mock analysis for now, the backend will handle routing dynamically
      return {
        goalDetected: "Process Request",
        confidence: 0.9,
        systemsRequired: ["CrewAI"],
        estimatedTimeMinutes: 1,
        approvalRequired: false
      };
    });
  }

  async submitIntent(
    workspaceId: string,
    prompt: string,
    context?: any
  ): Promise<OSEnvelope<{ intentId: string }>> {
    return executeApiCall('IntentService.submitIntent', workspaceId, async () => {
      const res = await fetch('http://localhost:8000/api/v1/intent/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, workspaceId })
      });
      const data = await res.json();
      return data.data;
    });
  }

  async approveIntent(
    workspaceId: string,
    intentId: string
  ): Promise<OSEnvelope<boolean>> {
    return executeApiCall('IntentService.approveIntent', workspaceId, async () => {
      const res = await fetch('http://localhost:8000/api/v1/intent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, intentId })
      });
      const data = await res.json();
      return data.success;
    });
  }
}

class ManageService {
  async getCapabilitiesHealth(workspaceId: string): Promise<OSEnvelope<CapabilityStatus[]>> {
    return executeApiCall('ManageService.getCapabilitiesHealth', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/capabilities?workspaceId=${encodeURIComponent(workspaceId)}`);
      const payload = await res.json();
      return payload.data;
    });
  }

  async testCapability(
    workspaceId: string,
    capabilityId: string
  ): Promise<OSEnvelope<CapabilityStatus | undefined>> {
    return executeApiCall('ManageService.testCapability', workspaceId, async () => {
      return undefined;
    });
  }

  async configureCapability(
    workspaceId: string,
    capabilityId: string
  ): Promise<OSEnvelope<CapabilityStatus | undefined>> {
    return executeApiCall('ManageService.configureCapability', workspaceId, async () => {
      return undefined;
    });
  }

  async runSuperintendentDiscovery(businessDescription?: string): Promise<any> {
    const res = await fetch('http://localhost:8000/api/v1/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'TalentXcel Services', businessDescription: businessDescription || '' })
    });
    return res.json();
  }
}

class ImportService {
  async getActiveImports(workspaceId: string): Promise<OSEnvelope<ImportJob[]>> {
    return executeApiCall('ImportService.getActiveImports', workspaceId, () =>
      intentOSRuntime.getActiveImports(workspaceId) as Promise<ImportJob[]>
    );
  }

  async startImport(workspaceId: string, source: string, totalItems?: number): Promise<OSEnvelope<ImportJob>> {
    return executeApiCall('ImportService.startImport', workspaceId, () =>
      intentOSRuntime.startImport(workspaceId, source, totalItems) as Promise<ImportJob>
    );
  }
}

class DiscoverService {
  async search(workspaceId: string, query: string): Promise<OSEnvelope<SearchResult[]>> {
    return executeApiCall('DiscoverService.search', workspaceId, async () => {
      const res = await fetch(`http://localhost:8000/api/v1/search?workspaceId=${encodeURIComponent(workspaceId)}&query=${encodeURIComponent(query)}`);
      const payload = await res.json();
      return payload.data;
    });
  }
}

export class OSGateway {
  static readonly Home = new HomeService();
  static readonly Watch = new WatchService();
  static readonly Intent = new IntentService();
  static readonly Manage = new ManageService();
  static readonly Import = new ImportService();
  static readonly Discover = new DiscoverService();
  static readonly subscribe = intentOSRuntime.subscribe;
}
