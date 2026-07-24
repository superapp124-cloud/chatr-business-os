import { IStorageAdapter } from '../../contracts/StorageContracts';

export class IndexedDBAdapter implements IStorageAdapter {
  // Stub implementation for Web targets
  public async transaction<T>(action: () => Promise<T>): Promise<T> { return action(); }
  public async get(_collection: string, _id: string): Promise<any> { return null; }
  public async query(_collection: string, _filter: any): Promise<any[]> { return []; }
  public async search(_collection: string, _fullTextQuery: string): Promise<any[]> { return []; }
  public async insert(_collection: string, _record: any): Promise<void> {}
  public async update(_collection: string, _id: string, _delta: any): Promise<void> {}
  public async softDelete(_collection: string, _id: string): Promise<void> {}
  public async getSnapshot(_collection: string, _id: string, _timestamp: number): Promise<any> { return null; }
  public async executeRaw(_sql: string, _params?: any[]): Promise<void> {}
}
