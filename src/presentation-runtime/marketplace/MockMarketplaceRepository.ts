import { CapabilityPack, Industry, IndustryTemplate, CapabilityCategory } from './models';
import { MarketplaceRepository } from './MarketplaceRepository';
import { MOCK_PACKS, MOCK_INDUSTRIES, MOCK_TEMPLATES } from './mockData';
import { PresentationEventBus } from '../events/PresentationEventBus';
import { CapabilityRuntime } from './runtime/CapabilityRuntime';

export class MockMarketplaceRepository implements MarketplaceRepository {
  private packs = MOCK_PACKS;
  private industries = MOCK_INDUSTRIES;
  private templates = MOCK_TEMPLATES;
  private runtime: CapabilityRuntime;

  constructor(private eventBus: PresentationEventBus) {
    this.runtime = new CapabilityRuntime(eventBus);
  }

  async getIndustries(): Promise<Industry[]> {
    return this.industries;
  }

  async getIndustryById(id: string): Promise<Industry | null> {
    return this.industries.find(i => i.id === id) || null;
  }

  async getTemplatesByIndustry(industryId: string): Promise<IndustryTemplate[]> {
    return this.templates.filter(t => t.industryId === industryId);
  }

  async getTemplateById(id: string): Promise<IndustryTemplate | null> {
    return this.templates.find(t => t.id === id) || null;
  }

  async getCapabilityPacks(): Promise<CapabilityPack[]> {
    return this.packs;
  }

  async getCapabilityPackById(id: string): Promise<CapabilityPack | null> {
    return this.packs.find(p => p.id === id) || null;
  }

  async getCapabilityPacksByCategory(category: CapabilityCategory): Promise<CapabilityPack[]> {
    return this.packs.filter(p => p.category === category);
  }

  async search(query: string): Promise<{ industries: Industry[]; templates: IndustryTemplate[]; packs: CapabilityPack[]; }> {
    const q = query.toLowerCase();
    return {
      industries: this.industries.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
      templates: this.templates.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
      packs: this.packs.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    };
  }

  async installPack(packId: string): Promise<void> {
    const pack = this.packs.find(p => p.id === packId);
    if (pack) {
      await this.runtime.installPack(pack);
    }
  }

  async installTemplate(templateId: string): Promise<void> {
    const template = this.templates.find(t => t.id === templateId);
    if (template) {
      const targetPacks = template.packs.map(pid => this.packs.find(p => p.id === pid)).filter(Boolean) as CapabilityPack[];
      await this.runtime.installTemplate(template, targetPacks);
    }
  }

  async uninstallPack(packId: string): Promise<void> {
    const pack = this.packs.find(item => item.id === packId);
    if (pack) pack.status = 'Available';
    this.eventBus.publish({ type: 'CapabilityRemoved', packId });
  }

  async updatePackConfiguration(): Promise<void> {}

  async getWorkspace() {
    throw new Error('Mock marketplace repository is not available in the Enterprise workspace.');
  }

  async getActivities() {
    return [];
  }

  subscribe() {
    return () => undefined;
  }
}
