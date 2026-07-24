'use strict';

/**
 * CHATR Kernel — System Indexer
 *
 * Background daemon combining native OS indexing with a CHATR-native enriched index.
 * Stores extended metadata: paths, owners, embeddings, workspace tags, etc.
 * Uses local SQLite for the index (Phase 1).
 */

const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const Database = require('better-sqlite3');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class SystemIndexer {
  constructor() {
    this.dbDir = path.join(os.homedir(), 'Documents', 'CHATR Workspace', 'Database');
    this.dbPath = path.join(this.dbDir, 'chatr-index.db');
    this.db = null;
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS system_index (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE,
          filename TEXT,
          extension TEXT,
          owner TEXT,
          created TEXT,
          modified TEXT,
          hash TEXT,
          summary TEXT,
          keywords TEXT,
          workspace TEXT,
          tags TEXT,
          permissions TEXT
        );
      `);

      this._initialized = true;
      log.info('[SystemIndexer] Initialized hybrid index database.');
    } catch (err) {
      log.error('[SystemIndexer] Failed to initialize database:', err);
    }
  }

  /**
   * Performs a hybrid search: queries the native OS (Windows Search via PowerShell)
   * AND the rich local SQLite index.
   */
  async search(query) {
    if (!this._initialized) await this.initialize();
    log.info(`[SystemIndexer] Executing hybrid search for: ${query}`);

    // 1. Query local CHATR index (Semantic / Rich Metadata)
    const localResults = this.db.prepare(`
      SELECT * FROM system_index 
      WHERE filename LIKE ? OR keywords LIKE ? OR summary LIKE ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);

    // 2. Query Windows Search (Native OS fallback)
    const nativeResults = await this._queryWindowsSearch(query);

    return {
      source: 'hybrid',
      query,
      results: {
        enriched: localResults,
        native: nativeResults
      }
    };
  }

  async _queryWindowsSearch(query) {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') return resolve([]);

      // Example of leveraging native OS indexing
      const psScript = `
        $results = @()
        try {
          $con = New-Object -ComObject ADODB.Connection
          $con.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
          $rs = New-Object -ComObject ADODB.Recordset
          $sql = "SELECT System.ItemName, System.ItemUrl FROM SystemIndex WHERE System.ItemName LIKE '%${query.replace(/'/g, "''")}%' OR System.ItemUrl LIKE '%${query.replace(/'/g, "''")}%'"
          $rs.Open($sql, $con)
          while (-not $rs.EOF) {
            $results += @{ Name = $rs.Fields.Item("System.ItemName").Value; Path = $rs.Fields.Item("System.ItemUrl").Value }
            $rs.MoveNext()
          }
          $rs.Close()
          $con.Close()
        } catch { }
        $results | ConvertTo-Json -Compress
      `;

      execFile('powershell.exe', ['-NoProfile', '-Command', psScript], (err, stdout) => {
        if (err) {
          log.warn('[SystemIndexer] Windows Search failed:', err.message);
          return resolve([]);
        }
        try {
          const parsed = JSON.parse(stdout || '[]');
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch (e) {
          resolve([]);
        }
      });
    });
  }
}

const systemIndexer = new SystemIndexer();
module.exports = { systemIndexer, SystemIndexer };
