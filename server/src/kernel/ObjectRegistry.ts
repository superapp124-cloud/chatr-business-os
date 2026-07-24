import { IWorkObject } from '../types.js';

export interface ObjectDefinition {
  type: string;
  name: string;
  departmentId: string;
  searchableFields: string[];
  defaultPermissions: Record<string, string[]>;
  schema?: any; // Validation schema (e.g., Zod)
}

class SystemObjectRegistry {
  private registry = new Map<string, ObjectDefinition>();

  /**
   * Registers a domain entity into the OS Kernel.
   * Modules (like Executive Office) call this on startup.
   */
  register(def: ObjectDefinition) {
    if (this.registry.has(def.type)) {
      console.warn(`[ObjectRegistry] Overwriting existing definition for type: ${def.type}`);
    }
    this.registry.set(def.type, def);
    console.log(`[ObjectRegistry] Registered: ${def.type} (${def.name})`);
  }

  get(type: string): ObjectDefinition | undefined {
    return this.registry.get(type);
  }

  getAll(): ObjectDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * Factory method to create a new Universal Work Object initialized with defaults
   * based on its registered definition.
   */
  createInstance(type: string, ownerId: string, tenantId: string, overrides: Partial<IWorkObject>): Partial<IWorkObject> {
    const def = this.get(type);
    if (!def) throw new Error(`Object type ${type} is not registered in the OS Kernel.`);

    return {
      type,
      departmentId: def.departmentId,
      status: 'draft',
      priority: 'medium',
      ownerId,
      tenantId,
      permissions: { ...def.defaultPermissions },
      knowledgeLinks: [],
      attachments: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }
}

export const ObjectRegistry = new SystemObjectRegistry();
