export type CapabilityCategory = 
  | 'Enterprise Foundation'
  | 'Business Operations'
  | 'Technology Operations'
  | 'AI & Intelligence'
  | 'Mobile & Offline'
  | 'Customer Operations'
  | 'Recruitment'
  | 'Healthcare'
  | 'IT Services'
  | string;

export interface CapabilityPack {
  id: string;
  name: string;
  version: string;
  category: CapabilityCategory;
  description: string;
  dependencies: string[]; // array of CapabilityPack IDs
  permissions: string[];
  objects: string[];
  processes: string[];
  policies: string[];
  requiredPacks?: string[];
  optionalPacks?: string[];
  previewImages: string[];
  author: string;
  certification: 'Verified' | 'Community' | 'Alpha';
  status: 'Available' | 'Installed' | 'Update Available';
  icon?: string;
}

export interface IndustryTemplate {
  id: string;
  industryId: string;
  name: string;
  description: string;
  packs: string[]; // Pre-configured bundle of CapabilityPack IDs
  icon?: string;
}

export interface Industry {
  id: string;
  name: string;
  description: string;
  icon: string;
  templates: string[]; // List of IndustryTemplate IDs
  packCount: number;
}
