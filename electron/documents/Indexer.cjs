const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const db = require('./Database.cjs');
const parserRegistry = require('./ParserRegistry.cjs');

class DocumentIndexer {
  constructor() {
    this.isIndexing = false;
  }

  // Helper to hash file path to create a consistent ID
  generateId(filePath) {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  async indexDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    
    console.log(`[DocumentIndexer] Scanning directory: ${dirPath}`);
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      
      // Skip hidden files/folders
      if (file.name.startsWith('.')) continue;

      if (file.isDirectory()) {
        // Simple depth limit or specific exclusions could go here (e.g. node_modules)
        if (file.name === 'node_modules' || file.name === '.git') continue;
        await this.indexDirectory(fullPath);
      } else if (file.isFile()) {
        await this.indexFile(fullPath);
      }
    }
  }

  async indexFile(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // We only index if we have a parser or it's a known document type
      const parser = parserRegistry.getParser(ext);
      if (!parser) return;

      const doc = {
        id: this.generateId(filePath),
        path: filePath,
        name: path.basename(filePath),
        extension: ext,
        size: stats.size,
        mime_type: 'application/octet-stream', // Could use mime-types package
        created_at: stats.birthtime.toISOString(),
        modified_at: stats.mtime.toISOString(),
        owner: 'local_user',
        language: 'en',
        hash: '', 
        indexed_timestamp: new Date().toISOString(),
        parser_version: parser.version,
        parsing_status: 'metadata_only', // Deep parsing happens on read
        source: 'Local',
        embedding_id: null,
        chunk_count: 0,
        vector_status: 'pending'
      };

      db.upsertDocument(doc);
    } catch (err) {
      console.warn(`[DocumentIndexer] Failed to index ${filePath}: ${err.message}`);
    }
  }

  async startBackgroundIndexing() {
    if (this.isIndexing) return;
    this.isIndexing = true;
    console.log('[DocumentIndexer] Starting background indexing...');

    try {
      const desktopDir = path.join(os.homedir(), 'Desktop');
      const documentsDir = path.join(os.homedir(), 'Documents');
      const downloadsDir = path.join(os.homedir(), 'Downloads');

      await this.indexDirectory(desktopDir);
      await this.indexDirectory(documentsDir);
      // await this.indexDirectory(downloadsDir); // Disabled Downloads for speed initially
      
      console.log('[DocumentIndexer] Background indexing completed.');
    } catch (err) {
      console.error('[DocumentIndexer] Error during indexing:', err);
    } finally {
      this.isIndexing = false;
    }
  }
}

module.exports = new DocumentIndexer();
