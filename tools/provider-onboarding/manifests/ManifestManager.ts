import fs from 'fs/promises';
import path from 'path';

export interface ProviderManifest {
  provider: {
    id: string;
  };
  version: string;
  category?: string;
  strategies: string[];
  permissions: string[];
  authentication: string;
  capabilities: string[];
  health: string;
}

export class ManifestManager {
  private templatesDir = path.join(process.cwd(), 'tools/provider-onboarding/templates');

  async generateManifest(providerId: string, overrides: Partial<ProviderManifest>): Promise<string> {
    const defaultManifest: ProviderManifest = {
      provider: { id: providerId },
      version: '1.0',
      category: 'general',
      strategies: ['api'],
      permissions: ['internet'],
      authentication: 'oauth2',
      capabilities: ['discover', 'execute', 'webhook'],
      health: 'certified'
    };

    const finalManifest = { ...defaultManifest, ...overrides };
    
    // Very basic YAML generator for V1
    const yaml = `provider:
  id: ${finalManifest.provider.id}

version: ${finalManifest.version}

category: ${finalManifest.category}

strategies:
${finalManifest.strategies.map(s => `  - ${s}`).join('\n')}

permissions:
${finalManifest.permissions.map(p => `  - ${p}`).join('\n')}

authentication:
  ${finalManifest.authentication}

capabilities:
${finalManifest.capabilities.map(c => `  - ${c}`).join('\n')}

health:
  ${finalManifest.health}
`;

    return yaml;
  }

  async saveManifest(providerId: string, yamlContent: string, destDir: string): Promise<void> {
    const filePath = path.join(destDir, 'manifest.yaml');
    await fs.writeFile(filePath, yamlContent);
  }
}
