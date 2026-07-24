import { 
  ProviderAdapter, 
  ProviderAuth, 
  HealthStatus, 
  RawPayload, 
  RawResponse, 
  CanonicalModel, 
  CanonicalRuntimeError, 
  RateLimitStatus,
  IdempotencyMode 
} from '../sdk/ProviderSDK';
import { ProviderHttpClient } from '../sdk/ProviderHttpClient';

export class GitHubGistAdapter implements ProviderAdapter {
  public id = 'provider.github';
  public version = '1.0.0';
  public supportedCapabilities = ['developer.createArtifact'];
  public idempotencyMode: IdempotencyMode = 'DETERMINISTIC_LOOKUP';
  
  private client = new ProviderHttpClient();
  private baseUrl = 'https://api.github.com';

  public async initialize(): Promise<void> {}
  public async shutdown(): Promise<void> {}

  public async health(): Promise<HealthStatus> {
    try {
      const res = await this.client.request({
        method: 'GET',
        url: `${this.baseUrl}/zen`,
        timeoutMs: 5000
      });
      return { isHealthy: res.statusCode === 200, latencyMs: res.metrics.requestLatencyMs };
    } catch {
      return { isHealthy: false, latencyMs: -1 };
    }
  }

  public async authenticate(auth: ProviderAuth): Promise<void> {
    // Only verifies authentication validity.
    const token = await auth.resolveSecret();
    const res = await this.client.request({
      method: 'GET',
      url: `${this.baseUrl}/user`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'CHATR-OS-Provider',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (res.statusCode === 401 || res.statusCode === 403) {
      throw this.mapError({ status: res.statusCode, message: 'Invalid PAT' });
    }
  }

  public async discoverCapabilities(): Promise<string[]> {
    return this.supportedCapabilities;
  }

  public async execute(capabilityId: string, payload: RawPayload, idempotencyKey: string, cancellationToken?: string): Promise<RawResponse> {
    if (capabilityId !== 'developer.createArtifact') throw new Error('Unsupported capability');
    
    // Auth Token Resolution (Never persisted in context)
    const token = payload._secretToken; // Passed dynamically by Execution Engine
    if (!token) throw new Error('Authentication required');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'CHATR-OS-Provider',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    // 1. Idempotency Deterministic Lookup
    const searchRes = await this.client.request({
      method: 'GET',
      url: `${this.baseUrl}/gists`,
      headers
    });
    
    if (searchRes.statusCode === 200) {
      const gists = JSON.parse(searchRes.body);
      // Look for a gist that has our idempotencyKey in the description
      const existing = gists.find((g: any) => g.description?.includes(`[CHATR-IDEMP:${idempotencyKey}]`));
      if (existing) {
        // Return existing to satisfy idempotency safely without creating duplicates
        return {
          statusCode: 200,
          body: JSON.stringify(existing),
          headers: searchRes.headers,
        } as RawResponse;
      }
    }

    // 2. Execution (POST)
    const description = `${payload.description || 'Generated Artifact'} [CHATR-IDEMP:${idempotencyKey}]`;
    const bodyPayload = {
      description,
      public: false,
      files: {
        [payload.filename || 'artifact.txt']: {
          content: payload.content || 'Empty content'
        }
      }
    };

    const res = await this.client.request({
      method: 'POST',
      url: `${this.baseUrl}/gists`,
      headers,
      body: JSON.stringify(bodyPayload)
    });

    return {
      statusCode: res.statusCode,
      body: res.body,
      headers: res.headers
    };
  }

  public async poll(transactionId: string): Promise<RawResponse> {
    throw new Error('Method not implemented.');
  }

  public async cancel(transactionId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  public normalize(rawResponse: RawResponse, capabilityId: string): CanonicalModel {
    const data = JSON.parse(rawResponse.body);
    return {
      artifactId: data.id,
      url: data.html_url,
      createdAt: data.created_at,
      status: rawResponse.statusCode === 201 || rawResponse.statusCode === 200 ? 'SUCCESS' : 'FAILED'
    };
  }

  public evaluateRateLimit(response: RawResponse): RateLimitStatus {
    const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '5000', 10);
    const resetAt = parseInt(response.headers['x-ratelimit-reset'] || '0', 10) * 1000;
    return { remaining, resetAt };
  }

  public mapError(rawError: any): CanonicalRuntimeError {
    const error: any = new Error(rawError.message || 'Unknown Provider Error');
    error.providerId = this.id;
    error.rawError = rawError;

    if (rawError.status === 401 || rawError.status === 403) {
      error.type = 'AuthenticationFailure';
      error.retryable = false;
    } else if (rawError.status === 429) {
      error.type = 'RateLimitExceeded';
      error.retryable = true;
    } else if (rawError.status >= 500) {
      error.type = 'ProviderUnavailable';
      error.retryable = true;
    } else if (rawError.code === 'ECONNRESET' || rawError.code === 'ETIMEDOUT') {
      error.type = 'NetworkFailure';
      error.retryable = true;
    } else {
      error.type = 'CapabilityError';
      error.retryable = false;
    }

    return error as CanonicalRuntimeError;
  }
}
