import { ImportRecord, ValidationStage } from './types';

export class ValidationPipeline {
  private stages: ValidationStage[] = [];

  addStage(stage: ValidationStage) {
    this.stages.push(stage);
  }

  async run(records: ImportRecord[], context: any = {}): Promise<ImportRecord[]> {
    const results: ImportRecord[] = [];
    
    // Process records in parallel batches to maintain high throughput
    const BATCH_SIZE = 1000;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      const processedBatch = await Promise.all(
        batch.map(async (record) => {
          let currentRecord = { ...record };
          
          for (const stage of this.stages) {
            try {
              currentRecord = await stage.validate(currentRecord, context);
            } catch (err: any) {
              currentRecord.status = 'invalid';
              currentRecord.errors.push({
                field: 'system',
                message: `Stage ${stage.name} failed: ${err.message}`,
                level: 'error'
              });
              break; // Stop processing this record if a stage throws a fatal error
            }
          }
          
          return currentRecord;
        })
      );
      
      results.push(...processedBatch);
    }
    
    return results;
  }
}

// Staged Validations
export const schemaValidationStage: ValidationStage = {
  name: 'Schema Validation',
  async validate(record: ImportRecord) {
    if (!record.target_object_type) {
      record.status = 'invalid';
      record.errors.push({ field: 'target', message: 'Target object type is required', level: 'error' });
    }
    return record;
  }
};

export const typeValidationStage: ValidationStage = {
  name: 'Data Type Validation',
  async validate(record: ImportRecord) {
    // Mock type checking logic for dates, numbers, booleans based on schema
    if (record.mapped_data.email && typeof record.mapped_data.email !== 'string') {
      record.status = 'invalid';
      record.errors.push({ field: 'email', message: 'Email must be a string', level: 'error' });
    }
    return record;
  }
};
