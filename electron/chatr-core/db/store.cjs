'use strict';
const persistence = require('./persistence.cjs');

/**
 * Local Database Simulation (Seed Data)
 * In production, this would be SQLite.
 */
class LocalDB {
  constructor() {
    this.data = this.load();
    this.seed();
  }

  load() {
    return persistence.retrieve('local_db') || this.getEmptyState();
  }

  getEmptyState() {
    return {
      contacts: [],
      documents: [],
      meetings: [],
      tasks: []
    };
  }

  save() {
    persistence.store('local_db', this.data);
  }

  seed() {
    // Demo seed data as requested
    if (this.data.contacts.length === 0) {
      this.data.contacts.push({ id: 'c_1', name: 'John Smith', email: 'john@example.com' });
      this.data.contacts.push({ id: 'c_2', name: 'Sarah Connor', email: 'sarah@example.com' });
      this.data.documents.push({ id: 'd_1', title: 'Project Genesis', type: 'proposal' });
      this.data.meetings.push({ id: 'm_1', title: 'Weekly Planning', time: 'Monday 9:00 AM' });
      this.save();
    }
  }

  findContactByName(name) {
    return this.data.contacts.find(c => c.name.toLowerCase().includes(name.toLowerCase())) || null;
  }

  findDocumentByTitle(title) {
    return this.data.documents.find(d => d.title.toLowerCase().includes(title.toLowerCase())) || null;
  }

  insertRecord(table, record) {
    if (!persistence.db) return record;
    try {
      const stmt = persistence.db.prepare(`
        INSERT INTO ${table} 
        (id, source_conversation_id, source_message_id, created_by, status, metadata) 
        VALUES (@id, @source_conversation_id, @source_message_id, @created_by, @status, @metadata)
      `);
      
      const payload = {
        id: record.id || require('crypto').randomUUID(),
        source_conversation_id: record.source_conversation_id || 'unknown',
        source_message_id: record.source_message_id || null,
        created_by: record.created_by || 'system',
        status: record.status || 'pending',
        metadata: JSON.stringify(record.metadata || {})
      };
      
      stmt.run(payload);
      return payload;
    } catch (e) {
      console.error(`[LocalDB] Insert into ${table} failed:`, e.message);
      return null;
    }
  }

  insertTask(task) {
    return this.insertRecord('tasks', {
      ...task,
      status: 'pending'
    });
  }

  insertMeeting(meeting) {
    return this.insertRecord('meetings', {
      ...meeting,
      status: 'pending'
    });
  }
}

module.exports = new LocalDB();
