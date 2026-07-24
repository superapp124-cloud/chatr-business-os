import { IStorageAdapter } from '../contracts/StorageContracts';

export async function up(db: IStorageAdapter): Promise<void> {
  // Registry Tables
  await db.executeRaw(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      deleted_at INTEGER
    )
  `);
  await db.executeRaw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS providers_fts USING fts5(data, content='providers', content_rowid='rowid')
  `);

  // Event Store
  await db.executeRaw(`
    CREATE TABLE IF NOT EXISTS events (
      eventId TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      entityId TEXT NOT NULL,
      eventType TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `);

  // Telemetry Store
  await db.executeRaw(`
    CREATE TABLE IF NOT EXISTS telemetry (
      traceId TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      providerId TEXT NOT NULL,
      capabilityId TEXT NOT NULL,
      latencyMs INTEGER NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT
    )
  `);

  // Snapshots
  await db.executeRaw(`
    CREATE TABLE IF NOT EXISTS snapshots (
      snapshotId TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      record_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      snapshot_data TEXT NOT NULL
    )
  `);
}
