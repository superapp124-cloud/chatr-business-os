/**
 * CHATR Business OS v1.0 - Connector Health Service
 * Centralized registry tracking Auth, Sync, Webhooks, Latency, and Error rates.
 */

export interface ConnectorHealthDescriptor {
  id: string;
  name: string;
  authStatus: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'UNLINKED';
  syncState: 'ACTIVE' | 'POLLING' | 'PAUSED' | 'INACTIVE';
  webhooksActive: boolean;
  lastSuccessAt: string;
  latencyMs: number;
  errorRatePercent: number;
  health: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
}

class ConnectorHealthRegistry {
  private connectors = new Map<string, ConnectorHealthDescriptor>();

  constructor() {
    this.initDefaultConnectors();
  }

  private initDefaultConnectors() {
    const now = new Date().toISOString();

    const list: ConnectorHealthDescriptor[] = [
      { id: 'gcal', name: 'Google Calendar', authStatus: 'VALID', syncState: 'ACTIVE', webhooksActive: true, lastSuccessAt: now, latencyMs: 120, errorRatePercent: 0.0, health: 'HEALTHY' },
      { id: 'gmail', name: 'Gmail', authStatus: 'VALID', syncState: 'POLLING', webhooksActive: false, lastSuccessAt: now, latencyMs: 350, errorRatePercent: 1.2, health: 'DEGRADED' },
      { id: 'm365', name: 'Microsoft 365', authStatus: 'VALID', syncState: 'POLLING', webhooksActive: false, lastSuccessAt: now, latencyMs: 420, errorRatePercent: 2.1, health: 'DEGRADED' },
      { id: 'slack', name: 'Slack', authStatus: 'VALID', syncState: 'ACTIVE', webhooksActive: true, lastSuccessAt: now, latencyMs: 95, errorRatePercent: 0.1, health: 'HEALTHY' },
      { id: 'github', name: 'GitHub', authStatus: 'VALID', syncState: 'ACTIVE', webhooksActive: true, lastSuccessAt: now, latencyMs: 80, errorRatePercent: 0.0, health: 'HEALTHY' },
      { id: 'notion', name: 'Notion', authStatus: 'UNLINKED', syncState: 'INACTIVE', webhooksActive: false, lastSuccessAt: 'Never', latencyMs: 0, errorRatePercent: 0.0, health: 'DISCONNECTED' },
      { id: 'jira', name: 'Jira', authStatus: 'UNLINKED', syncState: 'INACTIVE', webhooksActive: false, lastSuccessAt: 'Never', latencyMs: 0, errorRatePercent: 0.0, health: 'DISCONNECTED' },
      { id: 'salesforce', name: 'Salesforce', authStatus: 'UNLINKED', syncState: 'INACTIVE', webhooksActive: false, lastSuccessAt: 'Never', latencyMs: 0, errorRatePercent: 0.0, health: 'DISCONNECTED' },
      { id: 'dropbox', name: 'Dropbox', authStatus: 'VALID', syncState: 'ACTIVE', webhooksActive: true, lastSuccessAt: now, latencyMs: 190, errorRatePercent: 0.2, health: 'HEALTHY' },
      { id: 'gdrive', name: 'Google Drive', authStatus: 'VALID', syncState: 'ACTIVE', webhooksActive: true, lastSuccessAt: now, latencyMs: 140, errorRatePercent: 0.0, health: 'HEALTHY' }
    ];

    list.forEach(c => this.connectors.set(c.id, c));
  }

  public getAllConnectors(): ConnectorHealthDescriptor[] {
    return Array.from(this.connectors.values());
  }

  public getConnector(id: string): ConnectorHealthDescriptor | undefined {
    return this.connectors.get(id);
  }

  public updateHealth(id: string, updates: Partial<ConnectorHealthDescriptor>) {
    const existing = this.connectors.get(id);
    if (existing) {
      this.connectors.set(id, { ...existing, ...updates });
    }
  }
}

export const connectorHealthService = new ConnectorHealthRegistry();
