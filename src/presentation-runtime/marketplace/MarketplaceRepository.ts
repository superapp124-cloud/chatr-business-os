import { CapabilityPack, Industry, IndustryTemplate, CapabilityCategory } from './models';

export interface MarketplaceRepository {
  getIndustries(): Promise<Industry[]>;
  getIndustryById(id: string): Promise<Industry | null>;
  
  getTemplatesByIndustry(industryId: string): Promise<IndustryTemplate[]>;
  getTemplateById(id: string): Promise<IndustryTemplate | null>;
  
  getCapabilityPacks(): Promise<CapabilityPack[]>;
  getCapabilityPackById(id: string): Promise<CapabilityPack | null>;
  getCapabilityPacksByCategory(category: CapabilityCategory): Promise<CapabilityPack[]>;
  
  search(query: string): Promise<{
    industries: Industry[];
    templates: IndustryTemplate[];
    packs: CapabilityPack[];
  }>;
  
  installPack(packId: string): Promise<void>;
  installTemplate(templateId: string): Promise<void>;
  uninstallPack(packId: string): Promise<void>;
  updatePackConfiguration(packId: string, configuration: Record<string, unknown>): Promise<void>;
  getWorkspace(): Promise<import('./SupabaseMarketplaceRepository').EnterpriseWorkspace>;
  getActivities(limit?: number): Promise<import('./SupabaseMarketplaceRepository').EnterpriseActivity[]>;
  subscribe(onChange: () => void): import('../events/PresentationEventBus').Unsubscribe;
}
