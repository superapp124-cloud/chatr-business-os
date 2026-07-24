export interface ParsedEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface SecurityPolicy {
  classification: 'Public' | 'Private' | 'Enterprise' | 'Confidential';
  retentionDays?: number;
}

export interface DocumentMetadata {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
}

export interface UnifiedDocument {
  id: string; // e.g., doc_9f81a...
  hash: string; // SHA-256 for caching
  type: string;
  pages: number;
  language: string;
  rawText: string;
  metadata: DocumentMetadata;
  entities: ParsedEntity[];
  classification: {
    primary: string; // e.g., "resume", "invoice"
    confidence: number;
    alternatives: string[];
  };
  securityPolicy: SecurityPolicy;
}

export interface DocumentProvider {
  supports(mimeType: string): boolean;
  extract(file: File | Blob): Promise<Partial<UnifiedDocument>>;
}

export interface ActionItem {
  id: string;
  label: string;
  action: string;
  payload?: any;
}

export interface CapabilityInsight {
  title: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  explanation: string;
  actions: ActionItem[];
  widgets: string[];
  payload: any;
}

export interface DocumentCapability {
  canHandle(documents: UnifiedDocument[]): boolean;
  execute(documents: UnifiedDocument[]): Promise<CapabilityInsight>;
}
