import { DataConnector, ImportRecord, ImportJob, ImportMapping } from './types';
import { ValidationPipeline } from './ValidationPipeline';
import { MappingEngine } from './MappingEngine';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

export class ImportEngine {
  private pipeline: ValidationPipeline;
  private mappingEngine: MappingEngine;

  constructor(pipeline: ValidationPipeline, mappingEngine: MappingEngine) {
    this.pipeline = pipeline;
    this.mappingEngine = mappingEngine;
  }

  async processStream(
    connector: DataConnector, 
    file: File, 
    targetSchemaFields: string[], 
    tenantId: string
  ): Promise<ImportJob> {
    const job: ImportJob = {
      id: uuidv4(),
      tenant_id: tenantId,
      file_name: file.name,
      status: 'uploading',
      total_records: 0,
      processed_records: 0,
      valid_records: 0,
      error_records: 0,
      duplicate_records: 0,
      mappings: [],
    };

    let isFirstChunk = true;

    await connector.parseStream(file, async (rawRecords: any[]) => {
      if (isFirstChunk && rawRecords.length > 0) {
        // AI Mapping phase on headers
        const headers = Object.keys(rawRecords[0]);
        job.mappings = await this.mappingEngine.generateMappings(headers, targetSchemaFields);
        isFirstChunk = false;
        job.status = 'validating';
      }

      job.total_records += rawRecords.length;

      // Transform raw to mapped
      const mappedRecords: ImportRecord[] = rawRecords.map(raw => {
        const mappedData: any = {};
        job.mappings.forEach(m => {
          if (m.target_field && raw[m.source_column] !== undefined) {
            mappedData[m.target_field] = raw[m.source_column];
          }
        });

        return {
          id: uuidv4(),
          raw_data: raw,
          mapped_data: mappedData,
          status: 'pending',
          errors: [],
          target_object_type: 'unknown'
        };
      });

      // Pass through validation pipeline
      const validatedRecords = await this.pipeline.run(mappedRecords, { tenantId });
      
      // Update metrics
      for (const rec of validatedRecords) {
        job.processed_records++;
        if (rec.status === 'invalid') job.error_records++;
        else if (rec.status === 'duplicate') job.duplicate_records++;
        else job.valid_records++;
      }
      
      // Optional: Batch insert to a staging table in Supabase for user preview
    });

    job.status = 'completed';
    return job;
  }
}
