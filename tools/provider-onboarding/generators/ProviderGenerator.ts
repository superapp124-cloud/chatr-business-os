import fs from 'fs/promises';
import path from 'path';
import { ProviderCredentials } from '../vault/ProviderVault.js';

export class ProviderGenerator {
  private baseCapabilitiesDir = path.join(process.cwd(), 'src/core/capabilities');

  private sanitizeProviderName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  async generate(creds: ProviderCredentials): Promise<string> {
    const safeName = this.sanitizeProviderName(creds.providerName);
    const providerDir = path.join(this.baseCapabilitiesDir, safeName);
    
    // Create provider directory
    await fs.mkdir(providerDir, { recursive: true });

    // Generate manifest.json
    const manifest = {
      name: creds.providerName,
      version: '1.0.0',
      description: `Auto-generated provider plugin for ${creds.providerName}`,
      author: 'CHATR Onboarding Agent',
      endpoints: creds.webhookUrls || [],
      capabilities: ['discover', 'execute']
    };
    
    await fs.writeFile(
      path.join(providerDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Generate executor skeleton
    const executorCode = `
import { ICapabilityExecutor } from '../RuntimeInterfaces.js';

export class ${creds.providerName.replace(/\s+/g, '')}Executor implements ICapabilityExecutor {
  async execute(intent: any, context: any): Promise<any> {
    console.log('Executing ${creds.providerName} intent:', intent);
    return { status: 'success', provider: '${creds.providerName}' };
  }
}
`;
    await fs.writeFile(
      path.join(providerDir, 'executor.ts'),
      executorCode.trim()
    );

    // Generate basic tests
    const testCode = `
import { ${creds.providerName.replace(/\s+/g, '')}Executor } from './executor.js';

describe('${creds.providerName}Executor', () => {
  it('should execute successfully', async () => {
    const executor = new ${creds.providerName.replace(/\s+/g, '')}Executor();
    const result = await executor.execute({}, {});
    expect(result.status).toBe('success');
  });
});
`;
    await fs.writeFile(
      path.join(providerDir, 'executor.test.ts'),
      testCode.trim()
    );

    return providerDir;
  }
}
