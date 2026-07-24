import fs from 'fs/promises';
import path from 'path';

export interface ProviderKnowledge {
  providerName: string;
  authenticationMethod: string;
  oauthFlow?: string;
  rateLimits?: string;
  sandboxUrl?: string;
  productionUrl?: string;
  requiredScopes?: string[];
  commonErrors?: { code: string; resolution: string }[];
  lastVerifiedDate: string;
}

export class KnowledgeStore {
  private knowledgePath = path.join(process.cwd(), 'tools/provider-onboarding/knowledge/data');

  async init(): Promise<void> {
    try {
      await fs.access(this.knowledgePath);
    } catch {
      await fs.mkdir(this.knowledgePath, { recursive: true });
    }
  }

  async saveKnowledge(knowledge: ProviderKnowledge): Promise<void> {
    const filePath = path.join(this.knowledgePath, `${knowledge.providerName.toLowerCase()}.json`);
    await fs.writeFile(filePath, JSON.stringify(knowledge, null, 2));
  }

  async getKnowledge(providerName: string): Promise<ProviderKnowledge | null> {
    const filePath = path.join(this.knowledgePath, `${providerName.toLowerCase()}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as ProviderKnowledge;
    } catch {
      return null;
    }
  }
}
