import { storageEngine } from './storage/StorageEngine';
import { eventStore } from './storage/EventStore';
import { knowledgeGraph } from './memory/KnowledgeGraph';

async function seed() {
  console.log('[Seeder] Initializing Storage Engine...');
  await storageEngine.initialize();
  await knowledgeGraph.initializeSchema();

  // Clear existing for a clean slate
  await storageEngine.db.execute('DELETE FROM graph_edges');
  await storageEngine.db.execute('DELETE FROM graph_nodes');
  await storageEngine.db.execute('DELETE FROM event_log');

  console.log('[Seeder] Adding Knowledge Graph Nodes...');
  
  const teslaId = `org_${Date.now()}_1`;
  const elonId = `person_${Date.now()}_2`;
  const meetingId = `event_${Date.now()}_3`;
  
  await knowledgeGraph.addNode({
    id: teslaId,
    type: 'Company',
    label: 'Tesla, Inc.',
    attributes: { industry: 'Automotive', hq: 'Austin, TX' }
  });

  await knowledgeGraph.addNode({
    id: elonId,
    type: 'Person',
    label: 'Elon Musk',
    attributes: { role: 'CEO', email: 'elon@tesla.com' }
  });

  await knowledgeGraph.addNode({
    id: meetingId,
    type: 'Meeting',
    label: 'Q3 Product Strategy',
    attributes: { date: new Date().toISOString() }
  });

  await knowledgeGraph.addEdge({ sourceId: elonId, targetId: teslaId, relationship: 'WORKS_AT' });
  await knowledgeGraph.addEdge({ sourceId: elonId, targetId: meetingId, relationship: 'ATTENDED' });

  console.log('[Seeder] Adding Timeline Events...');
  
  await eventStore.append('email', {
    title: 'Project Alpha Update',
    preview: 'Here are the latest metrics for Q3...',
    sender: 'elon@tesla.com'
  }, 'gmail');

  await eventStore.append('meeting', {
    title: 'Q3 Product Strategy',
    preview: 'Reviewing next quarter goals',
    attendees: ['elon@tesla.com']
  }, 'calendar');

  await eventStore.append('message', {
    title: 'Deployment Success',
    preview: 'The new storage layer v1.0 is live in production.',
    channel: '#engineering'
  }, 'slack');

  await eventStore.append('document', {
    title: 'Architecture v1.0',
    preview: 'System design for the new SQLite based storage engine'
  }, 'drive');

  console.log('[Seeder] Seeding complete! Database is populated with real graph and event data.');
  process.exit(0);
}

seed().catch(err => {
  console.error('[Seeder] Failed:', err);
  process.exit(1);
});
