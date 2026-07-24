'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class SqliteKnowledgeProvider {
  constructor() {
    this.name = 'SqliteKnowledgeProvider';
    
    // Ensure data directory exists
    const userDataPath = app ? app.getPath('userData') : path.join(require('os').tmpdir(), 'chatr-mock');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    this.dbPath = path.join(userDataPath, 'knowledge.db');
    this.db = new Database(this.dbPath);
    
    // Initialize schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY, 
        label TEXT, 
        properties JSON
      );
      CREATE TABLE IF NOT EXISTS edges (
        source TEXT, 
        target TEXT, 
        relationship TEXT, 
        properties JSON, 
        PRIMARY KEY(source, target, relationship),
        FOREIGN KEY(source) REFERENCES nodes(id),
        FOREIGN KEY(target) REFERENCES nodes(id)
      );
    `);
  }

  async execute(capabilityId, parameters, context) {
    if (capabilityId === 'Knowledge.Store') {
      if (parameters.artifact && parameters.artifact.id) {
        return this.addNode(parameters.artifact.id, parameters.artifact.label, parameters.metadata);
      }
      return this.addNode(parameters.id, parameters.label, parameters.properties);
    }
    if (capabilityId === 'Knowledge.Retrieve') {
      return this.getNode(parameters.artifact_id || parameters.id);
    }
    throw new Error(`Unsupported capability: ${capabilityId}`);
  }

  /**
   * Adds an entity node to the graph.
   */
  async addNode(id, label, properties) {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (id, label, properties) 
      VALUES (?, ?, ?) 
      ON CONFLICT(id) DO UPDATE SET 
        label=excluded.label, 
        properties=excluded.properties
    `);
    stmt.run(id, label, JSON.stringify(properties || {}));
    return true;
  }

  /**
   * Adds a relationship edge between two entity nodes.
   */
  async addEdge(sourceId, targetId, relationship, properties = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO edges (source, target, relationship, properties) 
      VALUES (?, ?, ?, ?) 
      ON CONFLICT(source, target, relationship) DO UPDATE SET 
        properties=excluded.properties
    `);
    
    try {
      stmt.run(sourceId, targetId, relationship, JSON.stringify(properties || {}));
      return true;
    } catch (err) {
      if (err.message.includes('FOREIGN KEY')) {
        throw new Error(`Cannot add edge: Missing nodes (${sourceId} or ${targetId})`);
      }
      throw err;
    }
  }

  /**
   * Query the graph for connected entities.
   */
  async queryGraph(cypherQuery) {
    // For V1 we simulate extraction of the target from the cypher query
    // E.g. "MATCH (n)-[r]-(m) WHERE n.id = 'abc_industries' RETURN m"
    const match = cypherQuery.match(/n\.id = '([^']+)'/);
    if (!match) return [];
    const targetNodeId = match[1];

    const stmt = this.db.prepare(`
      SELECT 
        e.relationship, 
        e.properties as edgeProps,
        n.id, n.label, n.properties as nodeProps,
        CASE WHEN e.source = ? THEN 'out' ELSE 'in' END as direction
      FROM edges e
      JOIN nodes n ON (e.source = ? AND e.target = n.id) OR (e.target = ? AND e.source = n.id)
    `);

    const rows = stmt.all(targetNodeId, targetNodeId, targetNodeId);
    
    return rows.map(row => ({
      node: { id: row.id, label: row.label, properties: JSON.parse(row.nodeProps || '{}') },
      relationship: row.relationship,
      properties: JSON.parse(row.edgeProps || '{}'),
      direction: row.direction
    }));
  }
}

module.exports = { SqliteKnowledgeProvider };
