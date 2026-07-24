export interface StorageProvider {
  connect(): Promise<void>;
  
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number, lastInsertRowid: string | number }>;
  
  transaction<T>(callback: (provider: StorageProvider) => Promise<T>): Promise<T>;
  
  insert(table: string, data: Record<string, any>): Promise<string | number>;
  update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number>;
  delete(table: string, where: Record<string, any>): Promise<number>;
  
  backup(destinationPath: string): Promise<void>;
  restore(sourcePath: string): Promise<void>;
}
