'use strict';

/**
 * CHATR Kernel v2.0 — Knowledge Graph
 * 
 * A relational graph tracking entities:
 * User -> Company -> Projects -> Capabilities -> Connectors -> Documents -> People -> Tasks
 * 
 * Every future execution becomes smarter through relationship traversal.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class KnowledgeGraph {
  constructor() {
    this._nodes = new Map(); // id -> node
    this._edges = new Map(); // id -> edge (from, to, type, weight)
    this._persistPath = path.join(process.cwd(), '.chatr', 'knowledge_graph.json');
    this._init();
  }

  _init() {
    try {
      if (!fs.existsSync(path.dirname(this._persistPath))) {
        fs.mkdirSync(path.dirname(this._persistPath), { recursive: true });
      }
      if (fs.existsSync(this._persistPath)) {
        const data = fs.readFileSync(this._persistPath, 'utf8');
        const parsed = JSON.parse(data);
        for (const [id, node] of Object.entries(parsed.nodes || {})) this._nodes.set(id, node);
        for (const [id, edge] of Object.entries(parsed.edges || {})) this._edges.set(id, edge);
      } else {
        // Seed the graph with the current user
        this.addNode('local_user', 'User', { name: 'Local User' });
      }
    } catch (err) {
      log.warn('[KnowledgeGraph] Failed to load graph', err);
    }
  }

  _persist() {
    try {
      const data = {
        nodes: Object.fromEntries(this._nodes),
        edges: Object.fromEntries(this._edges)
      };
      fs.writeFileSync(this._persistPath, JSON.stringify(data, null, 2));
    } catch (err) {
      log.error('[KnowledgeGraph] Failed to persist graph', err);
    }
  }

  addNode(id, label, properties = {}) {
    id = id || crypto.randomUUID();
    const node = { id, label, properties, timestamp: Date.now() };
    this._nodes.set(id, node);
    this._persist();
    return id;
  }

  addEdge(fromId, toId, type, weight = 1.0) {
    if (!this._nodes.has(fromId) || !this._nodes.has(toId)) {
      log.warn(`[KnowledgeGraph] Cannot add edge ${type}, missing nodes`);
      return null;
    }
    const id = crypto.randomUUID();
    const edge = { id, from: fromId, to: toId, type, weight, timestamp: Date.now() };
    this._edges.set(id, edge);
    this._persist();
    return id;
  }

  /**
   * Tracks an execution in the knowledge graph.
   * Links User -> Intent -> Capability -> Connector -> Result
   */
  trackExecution(intentId, capability, connectorId, result) {
    const userId = 'local_user'; // For now, single user
    
    // Add Intent node
    this.addNode(intentId, 'Intent', { status: 'Executed' });
    this.addEdge(userId, intentId, 'EXECUTED');
    
    // Capability node (ensure exists)
    const capId = `cap_${capability}`;
    if (!this._nodes.has(capId)) this.addNode(capId, 'Capability', { name: capability });
    this.addEdge(intentId, capId, 'REQUIRES');

    // Connector node (ensure exists)
    if (connectorId) {
      const connId = `conn_${connectorId}`;
      if (!this._nodes.has(connId)) this.addNode(connId, 'Connector', { name: connectorId });
      this.addEdge(capId, connId, 'FULFILLED_BY');
      this.addEdge(intentId, connId, 'USED_CONNECTOR');
    }
    
    // Track output artifacts if any (e.g. people, documents mentioned)
    if (result && result.entities) {
      for (const entity of result.entities) {
        const entId = entity.id || crypto.randomUUID();
        if (!this._nodes.has(entId)) this.addNode(entId, entity.label, entity.properties);
        this.addEdge(intentId, entId, 'PRODUCED');
        this.addEdge(userId, entId, 'INTERACTED_WITH');
      }
    }

    log.info(`[KnowledgeGraph] Tracked execution for intent ${intentId}`);
  }

  queryRelated(nodeId, maxDepth = 2) {
    // Basic BFS for traversal
    const visited = new Set([nodeId]);
    const results = [];
    const queue = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;

      for (const edge of this._edges.values()) {
        const neighborId = edge.from === current.id ? edge.to : (edge.to === current.id ? edge.from : null);
        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId);
          results.push({ node: this._nodes.get(neighborId), relationship: edge.type, distance: current.depth + 1 });
          queue.push({ id: neighborId, depth: current.depth + 1 });
        }
      }
    }
    return results;
  }
}

const knowledgeGraph = new KnowledgeGraph();
module.exports = { knowledgeGraph, KnowledgeGraph };
