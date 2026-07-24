import express from 'express';
import cors from 'cors';
import { storageEngine } from './storage/StorageEngine';
import { eventStore } from './storage/EventStore';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure the storage engine is initialized
storageEngine.initialize().catch(err => {
  console.error('[KernelServer] Failed to initialize storage engine', err);
});

app.post('/api/intent', async (req, res) => {
  const { action, payload } = req.body;
  // Note: KernelClient sends { intent: string, payload: any }
  const intent = req.body.intent || action?.type || action;

  console.log(`[KernelServer] Received intent: ${intent}`);

  try {
    switch (intent) {
      case 'dashboard.get_status': {
        // Query storage engine stats
        const nodesQuery = await storageEngine.db.query('SELECT COUNT(*) as c FROM graph_nodes');
        const edgesQuery = await storageEngine.db.query('SELECT COUNT(*) as c FROM graph_edges');
        
        res.json({
          success: true,
          data: {
            nodes: (nodesQuery[0] as any)?.c || 0,
            edges: (edgesQuery[0] as any)?.c || 0,
            kernelStatus: 'running',
            vectorMemory: 'active'
          }
        });
        break;
      }

      case 'dashboard.get_timeline': {
        const events = await eventStore.getRecentEvents(10);
        res.json({
          success: true,
          data: events.map(e => ({
            id: e.id,
            time: new Date(e.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon: e.eventType === 'email' ? 'mail' : e.eventType === 'meeting' ? 'calendar' : 'message-square',
            title: e.payload?.title || e.eventType,
            detail: e.payload?.detail || e.payload?.preview || '',
            category: e.providerId
          }))
        });
        break;
      }

      case 'dashboard.get_active_intents': {
        res.json({
          success: true,
          data: [
            { id: 1, text: "Organize Q3 Planning", progress: 65, status: "Active" },
            { id: 2, text: "Draft project proposal", progress: 30, status: "Waiting for review" }
          ]
        });
        break;
      }

      case 'dashboard.get_recent_memory': {
        // Get recent nodes
        const recentNodes = await storageEngine.db.query('SELECT * FROM graph_nodes LIMIT 5');
        res.json({
          success: true,
          data: recentNodes.map((n: any) => ({
            id: n.id,
            type: n.type,
            title: n.label,
            time: new Date().toLocaleTimeString() // fallback
          }))
        });
        break;
      }

      case 'dashboard.search': {
        const query = req.body.payload?.query || '';
        const events = await eventStore.searchEvents(query, 15);
        res.json({
          success: true,
          data: events.map(e => ({
            id: e.id,
            time: new Date(e.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon: e.eventType === 'email' ? 'mail' : e.eventType === 'meeting' ? 'calendar' : 'message-square',
            title: e.payload?.title || e.eventType,
            detail: e.payload?.detail || e.payload?.preview || '',
            category: e.providerId
          }))
        });
        break;
      }

      case 'dashboard.get_intelligence_brief': {
        const brief = await eventStore.getIntelligenceBrief();
        res.json({
          success: true,
          data: brief
        });
        break;
      }

      default:
        res.status(404).json({ success: false, error: 'Intent not recognized' });
    }
  } catch (err: any) {
    console.error(`[KernelServer] Error handling intent ${intent}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 8087;
app.listen(PORT, () => {
  console.log(`[KernelServer] v2.0 Kernel API listening on port ${PORT}`);
});
