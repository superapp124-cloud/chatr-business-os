'use strict';

/**
 * CHATR Local Search Provider
 * Capability: memory.search
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalSearchProvider {
  constructor() {
    this.name = 'LocalSearchProvider';
  }

  async execute(capabilityId, parameters, context) {
    if (capabilityId === 'System.Search' || capabilityId === 'Knowledge.Discover') {
      return this._search(parameters);
    }
    throw new Error(`Unsupported capability: ${capabilityId}`);
  }

  async _search(parameters) {
    const query = parameters.query ? parameters.query.toLowerCase() : '';
    if (!query) return { found: false, files: [] };

    const workspacePath = path.join(os.homedir(), 'Documents', 'CHATR Workspace');
    
    // Ensure the folder exists
    if (!fs.existsSync(workspacePath)) {
      try {
        fs.mkdirSync(workspacePath, { recursive: true });
      } catch (e) {
        return { found: false, files: [], error: 'Failed to create workspace directory' };
      }
    }

    const results = [];
    try {
      const files = fs.readdirSync(workspacePath);
      
      for (const file of files) {
        const fullPath = path.join(workspacePath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          const lowerName = file.toLowerCase();
          let match = false;
          let preview = '';
          
          if (lowerName.includes(query)) {
            match = true;
          }
          
          // If it's a text file, search contents too
          if (file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.json')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes(query)) {
              match = true;
              // Simple preview generation (first 150 chars near the match)
              const matchIdx = content.toLowerCase().indexOf(query);
              const startIdx = Math.max(0, matchIdx - 30);
              preview = content.slice(startIdx, startIdx + 150).replace(/\s+/g, ' ').trim();
              if (startIdx > 0) preview = '...' + preview;
            } else if (match) {
              preview = content.slice(0, 150).replace(/\s+/g, ' ').trim();
            }
          }
          
          if (match) {
            results.push({
              name: file,
              path: fullPath,
              contentPreview: preview || 'Local File',
              timestamp: stat.mtime.toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.warn('[LocalSearchProvider] FS error:', err);
    }

    return { 
      found: results.length > 0, 
      source: 'filesystem',
      files: results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
    };
  }
}

module.exports = { LocalSearchProvider };
