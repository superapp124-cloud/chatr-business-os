export interface ImportRecord {
  id: string; // Temporary UUID for tracking
  raw_data: Record<string, any>; // The raw parsed row
  mapped_data: Record<string, any>; // The data after schema mapping
  status: 'pending' | 'valid' | 'invalid' | 'duplicate' | 'imported';
  errors: ValidationError[];
  target_object_type: string; // e.g., 'contact', 'lead'
}

export interface ValidationError {
  field: string;
  message: string;
  level: 'error' | 'warning';
}

export interface ImportMapping {
  source_column: string;
  target_field: string;
  confidence: number; // 0-1, 1 being exact match, < 1 being fuzzy/AI
  strategy: 'exact' | 'dictionary' | 'fuzzy' | 'ai';
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  file_name: string;
  status: 'uploading' | 'mapping' | 'validating' | 'importing' | 'completed' | 'failed';
  total_records: number;
  processed_records: number;
  valid_records: number;
  error_records: number;
  duplicate_records: number;
  mappings: ImportMapping[];
}

export interface DataConnector {
  name: string;
  supportedFormats: string[]; // e.g. ['csv', 'xlsx', 'json']
  
  // Streaming parser that yields chunks of raw records
  parseStream(file: File | Blob | string, onChunk: (records: any[]) => Promise<void>): Promise<void>;
}

export interface ValidationStage {
  name: string;
  validate(record: ImportRecord, context: any): Promise<ImportRecord>;
}
