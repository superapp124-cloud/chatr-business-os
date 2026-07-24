'use strict';

/**
 * CHATR Kernel — Personal Context Engine (Phase 5.2)
 *
 * Resolves personal, preference, and identity context for the current user.
 * This is DISTINCT from UserContextEngine (system: hardware, apps, browser).
 *
 * Personal context answers:
 *   "Where does Arshid live?"
 *   "What airline does he prefer?"
 *   "When does he usually work?"
 *   "Who does he frequently contact?"
 *   "What are his dietary preferences?"
 *
 * This data feeds the Decision Engine before any clarification question is asked.
 * The more personal context available, the fewer questions CHATR needs to ask.
 */

const path = require('path');
const fs   = require('fs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

let Database;
try { Database = require('better-sqlite3'); } catch { Database = null; }

// ── DB Setup ─────────────────────────────────────────────────────────────────

let _db = null;
function _getDb() {
  if (_db) return _db;
  if (!Database) return null;

  let dbPath;
  try {
    const { app } = require('electron');
    dbPath = path.join(app.getPath('userData'), 'personal-context.sqlite');
  } catch {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    dbPath = path.join(dir, 'personal-context.sqlite');
  }

  _db = new Database(dbPath);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS personal_profile (
      key    TEXT PRIMARY KEY,
      value  TEXT,
      source TEXT DEFAULT 'user',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS personal_places (
      label      TEXT PRIMARY KEY,   -- 'home', 'office', 'gym', 'parents'
      name       TEXT,
      address    TEXT,
      city       TEXT,
      country    TEXT DEFAULT 'IN',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS personal_preferences (
      category  TEXT,                -- 'transport', 'food', 'hotel', 'airline'
      key       TEXT,                -- 'preferred_airline', 'seat_preference'
      value     TEXT,
      PRIMARY KEY (category, key)
    );

    CREATE TABLE IF NOT EXISTS personal_contacts (
      name      TEXT,
      relation  TEXT,                -- 'colleague', 'family', 'client'
      email     TEXT,
      phone     TEXT,
      frequency INTEGER DEFAULT 0,  -- call/message frequency
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return _db;
}

// ── Default Personal Context (overridable by user) ────────────────────────────
// These are sensible defaults used until the user sets real values.
const DEFAULTS = {
  workingHours: { start: '09:00', end: '18:00' },
  preferredLanguage: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
};

// ── Personal Context Engine ───────────────────────────────────────────────────

class PersonalContextEngine {

  // ── Identity ──────────────────────────────────────────────────────────────

  getProfile() {
    const db = _getDb();
    if (!db) return {};
    const rows = db.prepare('SELECT key, value FROM personal_profile').all();
    const profile = {};
    for (const row of rows) profile[row.key] = row.value;
    return { ...DEFAULTS, ...profile };
  }

  setProfile(key, value) {
    const db = _getDb();
    if (!db) return;
    db.prepare(`
      INSERT INTO personal_profile (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, value);
  }

  // ── Places ────────────────────────────────────────────────────────────────

  getPlaces() {
    const db = _getDb();
    if (!db) return {};
    const rows = db.prepare('SELECT * FROM personal_places').all();
    const places = {};
    for (const row of rows) places[row.label] = row;
    return places;
  }

  setPlace(label, { name, address, city, country = 'IN' }) {
    const db = _getDb();
    if (!db) return;
    db.prepare(`
      INSERT INTO personal_places (label, name, address, city, country)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(label) DO UPDATE SET name=excluded.name, address=excluded.address,
        city=excluded.city, country=excluded.country, updated_at=CURRENT_TIMESTAMP
    `).run(label, name, address, city, country);
    log.info(`[PersonalContextEngine] Place '${label}' set to ${city}`);
  }

  getHome()   { return this.getPlaces().home   || null; }
  getOffice() { return this.getPlaces().office || null; }

  // ── Preferences ───────────────────────────────────────────────────────────

  getPreferences(category = null) {
    const db = _getDb();
    if (!db) return {};
    const rows = category
      ? db.prepare('SELECT key, value FROM personal_preferences WHERE category = ?').all(category)
      : db.prepare('SELECT category, key, value FROM personal_preferences').all();
    const prefs = {};
    for (const row of rows) {
      if (category) {
        prefs[row.key] = row.value;
      } else {
        if (!prefs[row.category]) prefs[row.category] = {};
        prefs[row.category][row.key] = row.value;
      }
    }
    return prefs;
  }

  setPreference(category, key, value) {
    const db = _getDb();
    if (!db) return;
    db.prepare(`
      INSERT INTO personal_preferences (category, key, value) VALUES (?, ?, ?)
      ON CONFLICT(category, key) DO UPDATE SET value = excluded.value
    `).run(category, key, value);
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  getContacts(relation = null) {
    const db = _getDb();
    if (!db) return [];
    return relation
      ? db.prepare('SELECT * FROM personal_contacts WHERE relation = ? ORDER BY frequency DESC').all(relation)
      : db.prepare('SELECT * FROM personal_contacts ORDER BY frequency DESC').all();
  }

  addContact({ name, relation, email, phone }) {
    const db = _getDb();
    if (!db) return;
    db.prepare(`
      INSERT INTO personal_contacts (name, relation, email, phone) VALUES (?, ?, ?, ?)
    `).run(name, relation || 'other', email || null, phone || null);
  }

  // ── Full Context Snapshot ─────────────────────────────────────────────────

  /**
   * Build a complete personal context snapshot for the Decision Engine.
   * @returns {object}
   */
  async buildContext() {
    const profile     = this.getProfile();
    const places      = this.getPlaces();
    const preferences = this.getPreferences();
    const contacts    = this.getContacts();

    return {
      identity: {
        language:     profile.language     || DEFAULTS.preferredLanguage,
        timezone:     profile.timezone     || DEFAULTS.timezone,
        workingHours: {
          start: profile.workingHoursStart || DEFAULTS.workingHours.start,
          end:   profile.workingHoursEnd   || DEFAULTS.workingHours.end,
        },
      },
      places,
      preferences: {
        transport: preferences.transport || {},
        food:      preferences.food      || {},
        hotel:     preferences.hotel     || {},
        airline:   preferences.airline   || {},
        shopping:  preferences.shopping  || {},
      },
      contacts: contacts.slice(0, 20),
    };
  }
}

const personalContextEngine = new PersonalContextEngine();
module.exports = { personalContextEngine, PersonalContextEngine };
