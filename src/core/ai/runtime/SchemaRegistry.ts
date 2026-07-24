export class SchemaRegistryImpl {
  private static instance: SchemaRegistryImpl;
  private schemas: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): SchemaRegistryImpl {
    if (!SchemaRegistryImpl.instance) {
      SchemaRegistryImpl.instance = new SchemaRegistryImpl();
    }
    return SchemaRegistryImpl.instance;
  }

  public register(name: string, schema: any) {
    this.schemas.set(name, schema);
  }

  public getSchema(name: string): any {
    const schema = this.schemas.get(name);
    if (!schema) throw new Error(`Schema ${name} not found in registry.`);
    return schema;
  }
}

export const schemaRegistry = SchemaRegistryImpl.getInstance();
