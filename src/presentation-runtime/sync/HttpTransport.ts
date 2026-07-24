import { KernelEvent } from '../../kernel/storage/EventStore';
import { SyncTransport, CommandEnvelope, SyncPullPayload } from './SyncTransport';

export class HttpTransport implements SyncTransport {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public setToken(token: string) {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Remote execution failed: ${response.status} - ${text}`);
    }

    return response.json();
  }

  async pullEventsSince(payload: SyncPullPayload): Promise<KernelEvent[]> {
    const { sequence, protocolVersion, clientId, sessionId } = payload;
    const response = await fetch(
      `${this.baseUrl}/api/v1/events?since=${sequence}&protocolVersion=${protocolVersion}&clientId=${clientId}&sessionId=${sessionId}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Pull events failed: ${response.status}`);
    }

    return response.json();
  }

  async uploadTelemetry(events: any[]): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/telemetry`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ events }),
    });
  }
}
