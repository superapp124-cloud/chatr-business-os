var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/core/server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);

// src/core/storage/StorageEngine.ts
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);

// src/core/storage/adapters/SQLiteAdapter.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var SQLiteAdapter = class {
  constructor(dbPath) {
    this.dbPath = dbPath;
  }
  db = null;
  async connect() {
    const dir = import_path.default.dirname(this.dbPath);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    this.db = new import_better_sqlite3.default(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    console.log(`[SQLiteAdapter] Connected to ${this.dbPath}`);
    this.initializeSchema();
  }
  initializeSchema() {
    if (!this.db) throw new Error("Database not connected");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        provider_id TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }
  async query(sql, params = []) {
    if (!this.db) throw new Error("Database not connected");
    const stmt = this.db.prepare(sql);
    return stmt.all(params);
  }
  async execute(sql, params = []) {
    if (!this.db) throw new Error("Database not connected");
    const stmt = this.db.prepare(sql);
    const info = stmt.run(params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  }
  async transaction(callback) {
    if (!this.db) throw new Error("Database not connected");
    const transaction = this.db.transaction(async () => {
      return await callback(this);
    });
    try {
      return await transaction();
    } catch (err) {
      console.error("[SQLiteAdapter] Transaction failed:", err);
      throw err;
    }
  }
  async insert(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => data[k]);
    const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
    const result = await this.execute(sql, values);
    return result.lastInsertRowid;
  }
  async update(table, data, where) {
    const updateKeys = Object.keys(data);
    const updateClauses = updateKeys.map((k) => `${k} = ?`).join(", ");
    const updateValues = updateKeys.map((k) => data[k]);
    const whereKeys = Object.keys(where);
    const whereClauses = whereKeys.map((k) => `${k} = ?`).join(" AND ");
    const whereValues = whereKeys.map((k) => where[k]);
    const sql = `UPDATE ${table} SET ${updateClauses} WHERE ${whereClauses}`;
    const result = await this.execute(sql, [...updateValues, ...whereValues]);
    return result.changes;
  }
  async delete(table, where) {
    const whereKeys = Object.keys(where);
    const whereClauses = whereKeys.map((k) => `${k} = ?`).join(" AND ");
    const whereValues = whereKeys.map((k) => where[k]);
    const sql = `DELETE FROM ${table} WHERE ${whereClauses}`;
    const result = await this.execute(sql, whereValues);
    return result.changes;
  }
  async backup(destinationPath) {
    if (!this.db) throw new Error("Database not connected");
    await this.db.backup(destinationPath);
    console.log(`[SQLiteAdapter] Backup completed to ${destinationPath}`);
  }
  async restore(sourcePath) {
    if (!import_fs.default.existsSync(sourcePath)) throw new Error(`Backup not found at ${sourcePath}`);
    console.log(`[SQLiteAdapter] Restored from ${sourcePath}`);
  }
};

// src/core/storage/StorageEngine.ts
var StorageEngine = class {
  db;
  paths = {
    root: "",
    database: "",
    attachments: "",
    documents: "",
    embeddings: "",
    cache: "",
    logs: "",
    thumbnails: "",
    exports: "",
    backups: "",
    models: "",
    plugins: "",
    temp: ""
  };
  async initialize(appDataPath = process.cwd()) {
    console.log(`[StorageEngine] Initializing storage at ${appDataPath}`);
    this.paths.root = import_path2.default.join(appDataPath, "CHATR");
    this.paths.database = import_path2.default.join(this.paths.root, "database");
    this.paths.attachments = import_path2.default.join(this.paths.root, "attachments");
    this.paths.documents = import_path2.default.join(this.paths.root, "documents");
    this.paths.embeddings = import_path2.default.join(this.paths.root, "embeddings");
    this.paths.cache = import_path2.default.join(this.paths.root, "cache");
    this.paths.logs = import_path2.default.join(this.paths.root, "logs");
    this.paths.thumbnails = import_path2.default.join(this.paths.root, "thumbnails");
    this.paths.exports = import_path2.default.join(this.paths.root, "exports");
    this.paths.backups = import_path2.default.join(this.paths.root, "backups");
    this.paths.models = import_path2.default.join(this.paths.root, "models");
    this.paths.plugins = import_path2.default.join(this.paths.root, "plugins");
    this.paths.temp = import_path2.default.join(this.paths.root, "temp");
    for (const [key, dirPath] of Object.entries(this.paths)) {
      if (key === "root") continue;
      if (!import_fs2.default.existsSync(dirPath)) {
        import_fs2.default.mkdirSync(dirPath, { recursive: true });
      }
    }
    const dbFilePath = import_path2.default.join(this.paths.database, "chatr.db");
    this.db = new SQLiteAdapter(dbFilePath);
    await this.db.connect();
    console.log("[StorageEngine] Storage ready.");
  }
  getAdapter() {
    return this.db;
  }
};
var storageEngine = new StorageEngine();

// src/core/runtime/EventSchemaRegistry.ts
var EventSchemaRegistryImpl = class {
  schemas = /* @__PURE__ */ new Map();
  constructor() {
    this.registerSystemSchemas();
  }
  register(schema) {
    this.schemas.set(schema.type, schema);
  }
  get(type) {
    return this.schemas.get(type);
  }
  isPersistent(type) {
    return this.schemas.get(type)?.persistent ?? false;
  }
  getPriority(type) {
    return this.schemas.get(type)?.priority ?? "normal";
  }
  registerSystemSchemas() {
    const defaultSchemas = [
      { type: "kernel.ready", version: "1.0", description: "System booted", persistent: false, priority: "critical" },
      { type: "kernel.crashed", version: "1.0", description: "System crash", persistent: true, priority: "critical" },
      { type: "auth.changed", version: "1.0", description: "Auth state changed", persistent: true, priority: "critical" },
      { type: "task.created", version: "1.0", description: "A new task was created", persistent: true, priority: "high" },
      { type: "chat.message.received", version: "1.0", description: "Chat message", persistent: true, priority: "high" },
      { type: "workspace.changed", version: "1.0", description: "Active workspace change", persistent: true, priority: "high" },
      { type: "search.executed", version: "1.0", description: "Search ran", persistent: false, priority: "normal" },
      { type: "telemetry.flushed", version: "1.0", description: "Metrics flush", persistent: false, priority: "background" },
      // Benchmarks
      { type: "benchmark.event.transient", version: "1.0", description: "Benchmark fast event", persistent: false, priority: "normal" },
      { type: "benchmark.event.persistent", version: "1.0", description: "Benchmark slow event", persistent: true, priority: "normal" }
    ];
    defaultSchemas.forEach((s) => this.register(s));
  }
};
var eventSchemaRegistry = new EventSchemaRegistryImpl();

// src/core/runtime/EventRuntime.ts
var InMemoryEventStore = class {
  store = [];
  async writeBatch(events) {
    this.store.push(...events);
    if (this.store.length > 5e4) {
      this.store = this.store.slice(-5e4);
    }
  }
  async query(filters) {
    return [...this.store];
  }
  shrink() {
    if (this.store.length > 1e4) {
      this.store = this.store.slice(-1e4);
    }
  }
};
var EventRuntimeImpl = class {
  // Routing
  subscribers = /* @__PURE__ */ new Map();
  // Delivery
  deliveryQueue = [];
  isDispatching = false;
  // Persistence
  storeAdapter = new InMemoryEventStore();
  persistenceBuffer = [];
  isFlushing = false;
  setStoreAdapter(adapter) {
    console.info(`[EventRuntime] Swapping EventStoreAdapter to ${adapter.constructor.name}`);
    this.storeAdapter = adapter;
  }
  // DLQ
  dlq = [];
  // Metrics tracking
  metrics = {
    publishedCount: 0,
    deliveredCount: 0,
    dlqCount: 0,
    batchFlushCount: 0,
    queueSaturation: 0
  };
  constructor() {
    setInterval(() => this.flushBatchWriter(), 500);
    this.subscribe("MEMORY_WARNING", () => {
      console.warn("[EventRuntime] Memory warning. Flushing buffers & DLQ.");
      if (this.deliveryQueue.length > 5e3) this.deliveryQueue.length = 5e3;
      if (this.persistenceBuffer.length > 5e3) this.persistenceBuffer.length = 5e3;
      if (this.dlq.length > 100) this.dlq.length = 100;
      if (this.storeAdapter.shrink) {
        this.storeAdapter.shrink();
      }
    });
  }
  // ─── Registration ───────────────────────────────────────────────────────────
  subscribe(type, handler, opts) {
    const sub = {
      id: crypto.randomUUID(),
      handler,
      priority: opts?.priority ?? "normal",
      once: opts?.once ?? false,
      timeoutMs: opts?.timeoutMs ?? 5e3,
      name: opts?.name ?? "anonymous"
    };
    const list = this.subscribers.get(type) ?? [];
    list.push(sub);
    this.subscribers.set(type, list);
    return () => {
      const current = this.subscribers.get(type) || [];
      this.subscribers.set(type, current.filter((s) => s.id !== sub.id));
    };
  }
  // ─── Publishing ─────────────────────────────────────────────────────────────
  realtimeActive = false;
  publish(type, payload, opts) {
    const schema = eventSchemaRegistry.get(type);
    const explicitlySkipPersist = opts?.persist === false;
    const event = {
      id: opts?.id || crypto.randomUUID(),
      // Preserve ID if given
      type,
      payload,
      schemaVersion: schema?.version ?? "1.0",
      timestamp: opts?.timestamp || Date.now(),
      source: opts?.source ?? "system",
      persist: explicitlySkipPersist ? false : opts?.persist ?? schema?.persistent ?? false,
      priority: opts?.priority ?? schema?.priority ?? "normal",
      workflowId: opts?.workflowId,
      traceId: opts?.traceId,
      correlationId: opts?.correlationId,
      causationId: opts?.causationId,
      tenantId: opts?.tenantId
    };
    this.metrics.publishedCount++;
    if (event.persist) {
      this.persistenceBuffer.push(event);
      if (!this.realtimeActive) {
        this.deliveryQueue.push(event);
      }
    } else {
      this.deliveryQueue.push(event);
    }
    this.triggerDispatcher();
    return event;
  }
  // ─── Delivery Dispatcher ────────────────────────────────────────────────────
  async triggerDispatcher() {
    if (this.isDispatching || this.deliveryQueue.length === 0) return;
    this.isDispatching = true;
    try {
      while (this.deliveryQueue.length > 0) {
        this.metrics.queueSaturation = Math.min(100, this.deliveryQueue.length / 1e4 * 100);
        const event = this.deliveryQueue.shift();
        if (!event) break;
        const specificSubs = this.subscribers.get(event.type) || [];
        const wildcardSubs = this.subscribers.get("*") || [];
        const subs = [...specificSubs, ...wildcardSubs];
        const toRemove = [];
        await Promise.allSettled(subs.map(async (sub) => {
          try {
            await Promise.race([
              sub.handler(event),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Subscriber Timeout")), sub.timeoutMs))
            ]);
            this.metrics.deliveredCount++;
            if (sub.once) toRemove.push(sub.id);
          } catch (err) {
            this.handleDeliveryFailure(event, sub, err);
          }
        }));
        if (toRemove.length > 0) {
          const current = this.subscribers.get(event.type) || [];
          this.subscribers.set(event.type, current.filter((s) => !toRemove.includes(s.id)));
          const currentWild = this.subscribers.get("*") || [];
          this.subscribers.set("*", currentWild.filter((s) => !toRemove.includes(s.id)));
        }
      }
    } finally {
      this.isDispatching = false;
      this.metrics.queueSaturation = 0;
    }
  }
  handleDeliveryFailure(event, sub, err) {
    console.error(`[EventRuntime] Subscriber ${sub.name} failed on ${event.type}:`, err);
    this.metrics.dlqCount++;
    this.dlq.push({
      event,
      subscriberName: sub.name,
      failureReason: err.message || "Unknown Error",
      retryCount: 0,
      firstFailure: Date.now(),
      lastFailure: Date.now()
    });
  }
  // ─── Batch Writer ───────────────────────────────────────────────────────────
  async flushBatchWriter() {
    if (this.isFlushing || this.persistenceBuffer.length === 0) return;
    this.isFlushing = true;
    try {
      const batch = this.persistenceBuffer.splice(0, 1e3);
      if (batch.length > 0) {
        await this.storeAdapter.writeBatch(batch);
        this.metrics.batchFlushCount++;
      }
    } catch (err) {
      console.error("[EventRuntime] Batch persistence failed", err);
    } finally {
      this.isFlushing = false;
    }
  }
  // ─── Replay Engine ──────────────────────────────────────────────────────────
  async replay(events, mode) {
    console.warn(`[EventRuntime] Replaying ${events.length} events in ${mode} mode`);
    for (const event of events) {
      const subs = this.subscribers.get(event.type) || [];
      for (const sub of subs) {
        try {
          await sub.handler(event);
        } catch {
        }
      }
    }
  }
};
var eventRuntime = new EventRuntimeImpl();

// src/core/runtime/EventBus.ts
var EventBusFacade = class {
  // ─── Subscribe ──────────────────────────────────────────────────────────────
  on(type, handler, opts) {
    return eventRuntime.subscribe(type, handler, opts);
  }
  once(type, handler) {
    return this.on(type, handler, { once: true });
  }
  onAny(handler) {
    return eventRuntime.subscribe("*", handler);
  }
  // Backward compatibility alias for 'on'
  subscribe(type, handler) {
    return this.on(type, handler);
  }
  // Backward compatibility alias
  unsubscribe(type, handler) {
  }
  // ─── Persistence ──────────────────────────────────────────────────────────
  setPersistenceHandler(handler) {
    const originalQuery = eventRuntime.storeAdapter.query;
    eventRuntime.storeAdapter = {
      writeBatch: async (events) => {
        for (const e of events) {
          handler(e);
        }
      },
      query: originalQuery
    };
  }
  // ─── Publish ───────────────────────────────────────────────────────────────
  publish(type, payload, opts) {
    const options = typeof opts === "string" ? { source: opts } : opts ?? {};
    return eventRuntime.publish(type, payload, options);
  }
  // ─── Replay ───────────────────────────────────────────────────────────────
  replay(events, mode = "Debugging") {
    eventRuntime.replay(events, mode).catch(console.error);
  }
  // Proxy the metrics for the old health store
  get throughputPerSecond() {
    return eventRuntime.metrics.publishedCount;
  }
};
var eventBus = new EventBusFacade();

// src/core/storage/EventStore.ts
var EventStore = class {
  async append(eventType, payload, providerId) {
    const db = storageEngine.getAdapter();
    const event = {
      eventType,
      payload: JSON.stringify(payload),
      providerId,
      createdAt: Date.now()
    };
    const id = await db.insert("event_log", {
      event_type: event.eventType,
      payload: event.payload,
      provider_id: event.providerId,
      created_at: event.createdAt
    });
    console.log(`[EventStore] Appended event ${eventType} (ID: ${id})`);
    eventBus.publish("chatr:store-event", { id, eventType, payload, providerId }, "EventStore");
    return id;
  }
  async replay(fromId = 0, callback) {
    const db = storageEngine.getAdapter();
    const rows = await db.query("SELECT * FROM event_log WHERE id > ? ORDER BY id ASC", [fromId]);
    for (const row of rows) {
      await callback({
        id: row.id,
        eventType: row.event_type,
        payload: JSON.parse(row.payload),
        providerId: row.provider_id,
        createdAt: row.created_at
      });
    }
  }
  async getRecentEvents(limit = 10) {
    const db = storageEngine.getAdapter();
    const rows = await db.query("SELECT * FROM event_log ORDER BY created_at DESC LIMIT ?", [limit]);
    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload),
      providerId: row.provider_id,
      createdAt: row.created_at
    }));
  }
};
var eventStore = new EventStore();

// src/core/server.ts
var app = (0, import_express.default)();
app.use((0, import_cors.default)());
app.use(import_express.default.json());
storageEngine.initialize().catch((err) => {
  console.error("[KernelServer] Failed to initialize storage engine", err);
});
app.post("/api/intent", async (req, res) => {
  const { action, payload } = req.body;
  const intent = req.body.intent || action?.type || action;
  console.log(`[KernelServer] Received intent: ${intent}`);
  try {
    switch (intent) {
      case "dashboard.get_status": {
        const nodesQuery = await storageEngine.db.query("SELECT COUNT(*) as c FROM graph_nodes");
        const edgesQuery = await storageEngine.db.query("SELECT COUNT(*) as c FROM graph_edges");
        res.json({
          success: true,
          data: {
            nodes: nodesQuery[0]?.c || 0,
            edges: edgesQuery[0]?.c || 0,
            kernelStatus: "running",
            vectorMemory: "active"
          }
        });
        break;
      }
      case "dashboard.get_timeline": {
        const events = await eventStore.getRecentEvents(10);
        res.json({
          success: true,
          data: events.map((e) => ({
            id: e.id,
            time: new Date(e.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            icon: e.eventType === "email" ? "mail" : e.eventType === "meeting" ? "calendar" : "message-square",
            title: e.payload?.title || e.eventType,
            detail: e.payload?.detail || e.payload?.preview || "",
            category: e.providerId
          }))
        });
        break;
      }
      case "dashboard.get_active_intents": {
        res.json({
          success: true,
          data: [
            { id: 1, text: "Organize Q3 Planning", progress: 65, status: "Active" },
            { id: 2, text: "Draft project proposal", progress: 30, status: "Waiting for review" }
          ]
        });
        break;
      }
      case "dashboard.get_recent_memory": {
        const recentNodes = await storageEngine.db.query("SELECT * FROM graph_nodes LIMIT 5");
        res.json({
          success: true,
          data: recentNodes.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.label,
            time: (/* @__PURE__ */ new Date()).toLocaleTimeString()
            // fallback
          }))
        });
        break;
      }
      case "dashboard.search": {
        const query = req.body.payload?.query || "";
        const events = await eventStore.searchEvents(query, 15);
        res.json({
          success: true,
          data: events.map((e) => ({
            id: e.id,
            time: new Date(e.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            icon: e.eventType === "email" ? "mail" : e.eventType === "meeting" ? "calendar" : "message-square",
            title: e.payload?.title || e.eventType,
            detail: e.payload?.detail || e.payload?.preview || "",
            category: e.providerId
          }))
        });
        break;
      }
      case "dashboard.get_intelligence_brief": {
        const brief = await eventStore.getIntelligenceBrief();
        res.json({
          success: true,
          data: brief
        });
        break;
      }
      default:
        res.status(404).json({ success: false, error: "Intent not recognized" });
    }
  } catch (err) {
    console.error(`[KernelServer] Error handling intent ${intent}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});
var PORT = 8087;
app.listen(PORT, () => {
  console.log(`[KernelServer] v2.0 Kernel API listening on port ${PORT}`);
});
