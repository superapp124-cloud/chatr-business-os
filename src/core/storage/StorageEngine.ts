import path from 'path';
import fs from 'fs';
import { SQLiteAdapter } from './adapters/SQLiteAdapter';
import { StorageProvider } from './StorageProvider';

export class StorageEngine {
  public db!: StorageProvider;
  
  public paths = {
    root: '',
    database: '',
    attachments: '',
    documents: '',
    embeddings: '',
    cache: '',
    logs: '',
    thumbnails: '',
    exports: '',
    backups: '',
    models: '',
    plugins: '',
    temp: ''
  };

  public async initialize(appDataPath: string = process.cwd()): Promise<void> {
    console.log(`[StorageEngine] Initializing storage at ${appDataPath}`);
    this.paths.root = path.join(appDataPath, 'CHATR');
    
    // Define standardized layout
    this.paths.database = path.join(this.paths.root, 'database');
    this.paths.attachments = path.join(this.paths.root, 'attachments');
    this.paths.documents = path.join(this.paths.root, 'documents');
    this.paths.embeddings = path.join(this.paths.root, 'embeddings');
    this.paths.cache = path.join(this.paths.root, 'cache');
    this.paths.logs = path.join(this.paths.root, 'logs');
    this.paths.thumbnails = path.join(this.paths.root, 'thumbnails');
    this.paths.exports = path.join(this.paths.root, 'exports');
    this.paths.backups = path.join(this.paths.root, 'backups');
    this.paths.models = path.join(this.paths.root, 'models');
    this.paths.plugins = path.join(this.paths.root, 'plugins');
    this.paths.temp = path.join(this.paths.root, 'temp');

    // Create directories if they don't exist
    for (const [key, dirPath] of Object.entries(this.paths)) {
      if (key === 'root') continue;
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // Initialize Database
    const dbFilePath = path.join(this.paths.database, 'chatr.db');
    this.db = new SQLiteAdapter(dbFilePath);
    await this.db.connect();
    
    console.log('[StorageEngine] Storage ready.');
  }

  public getAdapter(): StorageProvider {
    return this.db;
  }
}

export const storageEngine = new StorageEngine();
