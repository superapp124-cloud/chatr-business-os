export class SchemaRegistry {
  private schemas: Map<string, any> = new Map();

  constructor() {
    this.schemas.set('WeatherSchemaV1', {
      type: 'object',
      properties: {
        temperature: { type: 'number' },
        unit: { type: 'string' },
        provider: { type: 'string' }
      }
    });
  }

  getSchema(id: string) {
    return this.schemas.get(id);
  }
}

export const schemaRegistry = new SchemaRegistry();
