import { v4 as uuidv4 } from 'uuid';

export interface IBusinessObjectRepository {
  create(namespace: string, objectName: string, data: any): Promise<any>;
  findById(namespace: string, objectName: string, id: string): Promise<any>;
  findAll(namespace: string, objectName: string, filters?: any): Promise<any[]>;
  update(namespace: string, objectName: string, id: string, data: any): Promise<any>;
  delete(namespace: string, objectName: string, id: string): Promise<boolean>;
}

export class InMemoryBusinessObjectRepository implements IBusinessObjectRepository {
  // Store format: store[namespace][objectName][id] = data
  private store: Record<string, Record<string, Record<string, any>>> = {};

  private getObjectStore(namespace: string, objectName: string) {
    if (!this.store[namespace]) {
      this.store[namespace] = {};
    }
    if (!this.store[namespace][objectName]) {
      this.store[namespace][objectName] = {};
    }
    return this.store[namespace][objectName];
  }

  async create(namespace: string, objectName: string, data: any): Promise<any> {
    const objectStore = this.getObjectStore(namespace, objectName);
    const id = uuidv4();
    const record = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    objectStore[id] = record;
    return record;
  }

  async findById(namespace: string, objectName: string, id: string): Promise<any> {
    const objectStore = this.getObjectStore(namespace, objectName);
    return objectStore[id] || null;
  }

  async findAll(namespace: string, objectName: string, filters?: any): Promise<any[]> {
    const objectStore = this.getObjectStore(namespace, objectName);
    let results = Object.values(objectStore);
    
    // Basic filtering support
    if (filters) {
      results = results.filter(record => {
        for (const [key, value] of Object.entries(filters)) {
          if (record[key] !== value) return false;
        }
        return true;
      });
    }
    
    // Sort by createdAt descending by default
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async update(namespace: string, objectName: string, id: string, data: any): Promise<any> {
    const objectStore = this.getObjectStore(namespace, objectName);
    if (!objectStore[id]) {
      throw new Error(`Record ${id} not found in ${namespace}/${objectName}`);
    }
    const record = {
      ...objectStore[id],
      ...data,
      id, // ensure ID cannot be overwritten
      updatedAt: new Date().toISOString()
    };
    objectStore[id] = record;
    return record;
  }

  async delete(namespace: string, objectName: string, id: string): Promise<boolean> {
    const objectStore = this.getObjectStore(namespace, objectName);
    if (objectStore[id]) {
      delete objectStore[id];
      return true;
    }
    return false;
  }
}

// Global instance for the mock backend
export const repository = new InMemoryBusinessObjectRepository();
