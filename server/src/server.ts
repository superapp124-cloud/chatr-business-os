import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { freeWebScrape } from '../../searchProvider.js';
import { IntentClassifier } from './intentClassifier.js';
import { RetrievalFilter } from './retrievalFilter.js';
import { RetrievalLogger } from './logger.js';
import { repository } from './kernel/data/BusinessObjectRepository.js';

const app = express();
app.use(express.json());
app.use(cors());

const handleSearchStream = async (req: express.Request, res: express.Response) => {
  const startMs = Date.now();
  let query = (req.query.q as string) || "";
  if (!query) return res.status(400).json({ error: "Empty query string." });

  query = query.replace(/(.+?)\1+/gi, "$1").trim();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Phase 1: Intent & Expansion
  const intentResult = IntentClassifier.classify(query);
  
  // Phase 1: Retrieval (Using the 0-cost crawler for now)
  // In Phase 3 this will be multi-provider orchestrated
  let rawSources = [];
  try {
    rawSources = await freeWebScrape(intentResult.expandedQueries[0] || query);
  } catch (error) {
    console.error("Retrieval failed", error);
  }

  // Phase 1: Trust Scoring & Retrieval Filtering
  const rankedSources = RetrievalFilter.filterAndRank(query, rawSources, intentResult);

  const endMs = Date.now();
  
  // Observability Logging
  RetrievalLogger.log({
    query,
    expandedQueries: intentResult.expandedQueries,
    selectedSources: rankedSources.map(s => s.url),
    rejectedSources: rawSources.filter(r => !rankedSources.some(s => s.url === r.url)).map(r => r.url),
    scores: Object.fromEntries(rankedSources.map(s => [s.url, s.compositeScore])),
    providerUsed: 'duckduckgo-html',
    latencyMs: endMs - startMs
  });

  const mappedCards = rankedSources.map((s, index) => ({
    ...s,
    index: index + 1,
    source: TrustScorer.extractDomain(s.url)
  }));

  res.write(`data: ${JSON.stringify({ type: 'sources', cards: mappedCards })}\n\n`);

  // To-Do: Phase 2 AI Synthesis & Semantic Reranking will drop in here
  res.write(`data: ${JSON.stringify({ type: 'token', token: `Phase 1 Retrieval pipeline execution complete. Detected Intent: ${intentResult.intent}. Ranked ${rankedSources.length} sources.` })}\n\n`);
  res.write(`data: ${JSON.stringify({ status: 'complete' })}\n\n`);
  res.end();
};

app.get('/api/search/fast-stream', handleSearchStream);
app.get('/api/search/agent', handleSearchStream);

import { IntentService } from './services/IntentService.js';
import { WorkflowEngine } from './services/WorkflowService.js';
import { ApprovalEngine } from './services/ApprovalService.js';
import { TimelineRuntime } from './services/TimelineService.js';
import { SearchRuntime } from './services/SearchService.js';
import { CapabilityLoader } from './kernel/CapabilityLoader.js';
import { loadStaticCapabilities } from './kernel/StaticCapabilityRegistry.js';
import { RecoveryEngine } from './kernel/execution/RecoveryEngine.js';
import { createClient } from '@supabase/supabase-js';

// ─── Boot: Load 58 First-Party Capability Packages ───────────────────────────
// Static registry loads synchronously first — guarantees marketplace is ready
loadStaticCapabilities();

// Then discover any additional capability packages from the filesystem
CapabilityLoader.discoverAndLoad().catch(err => console.error('Failed to load file-based capabilities:', err));

// Boot the Recovery Engine (Durability Phase 2A)
RecoveryEngine.bootAndRecover().catch(err => console.error('Failed to boot RecoveryEngine:', err));


const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
if (!supabase) console.warn('[Server] Supabase not configured — DB features disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');


app.post('/api/intent/resolve', async (req: express.Request, res: express.Response) => {
  try {
    const { text, userId, tenantId, departmentContext } = req.body;
    
    if (!text || !userId || !tenantId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await IntentService.resolveIntent(text, userId, tenantId, departmentContext);
    res.json(result);
  } catch (err: any) {
    console.error('Intent Resolution Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/decisions', async (req: express.Request, res: express.Response) => {
  try {
    // In a real app we pass tenantId via headers
    const { data, error } = await supabase
      .from('os_work_objects')
      .select('*, exec_decisions(*)')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { CapabilityRuntime } from './kernel/CapabilityRuntime.js';
import { TenantProvisioner } from './kernel/tenant/TenantProvisioner.js';

// In-memory config store per tenant per capability (use DB in production)
const capabilityConfigs: Record<string, any> = {};

app.get('/api/capabilities/available', (req, res) => {
  const packages = CapabilityRuntime.getAllPackages();
  // Return FULL manifest data so the UI can display rich marketplace cards and BOR schemas
  res.json(packages.map((pkg: any) => {
    const m = pkg.manifest;
    return {
      ...m, // spread the full manifest
      workflows: pkg.workflows?.length || 0,
    };
  }));
});


app.post('/api/capabilities/install', async (req, res) => {
  const { tenantId, capabilityId } = req.body;
  if (!tenantId || !capabilityId) return res.status(400).json({ error: 'Missing tenantId or capabilityId' });
  try {
    await TenantProvisioner.installCapability(tenantId, capabilityId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/capabilities/configure', (req, res) => {
  const { tenantId, capabilityId, config } = req.body;
  if (!tenantId || !capabilityId || !config) return res.status(400).json({ error: 'Missing parameters' });
  const key = `${tenantId}:${capabilityId}`;
  capabilityConfigs[key] = { ...capabilityConfigs[key], ...config, updatedAt: new Date().toISOString() };
  console.log(`[CapabilityConfig] Saved config for ${capabilityId} (tenant: ${tenantId}):`, capabilityConfigs[key]);
  res.json({ success: true, config: capabilityConfigs[key] });
});

app.get('/api/capabilities/:id/config', (req, res) => {
  const tenantId = req.query.tenantId as string || '11111111-1111-1111-1111-111111111111';
  const key = `${tenantId}:${req.params.id}`;
  res.json(capabilityConfigs[key] || {});
});

// ─── BUSINESS OBJECT RUNTIME (BOR) API ────────────────────────────────────────

app.post('/api/data/:namespace/:object', async (req, res) => {
  try {
    const { namespace, object } = req.params;
    const record = await repository.create(namespace, object, req.body);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/:namespace/:object', async (req, res) => {
  try {
    const { namespace, object } = req.params;
    const filters = req.query;
    const records = await repository.findAll(namespace, object, Object.keys(filters).length ? filters : undefined);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/:namespace/:object/:id', async (req, res) => {
  try {
    const { namespace, object, id } = req.params;
    const record = await repository.findById(namespace, object, id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/data/:namespace/:object/:id', async (req, res) => {
  try {
    const { namespace, object, id } = req.params;
    const record = await repository.update(namespace, object, id, req.body);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data/:namespace/:object/:id', async (req, res) => {
  try {
    const { namespace, object, id } = req.params;
    const success = await repository.delete(namespace, object, id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


import { TenantRegistry } from './kernel/tenant/TenantRegistry.js';

app.get('/api/tenant/:id/organization', (req, res) => {
  const tenantId = req.params.id;
  const descriptor = TenantRegistry.getDescriptor(tenantId);
  if (!descriptor) return res.status(404).json({ error: 'Tenant not found' });
  
  // Build dynamic departments based on capabilities
  const departments = (descriptor.capabilities || []).map(cap => {
    const manifest = CapabilityRuntime.getAll().find(m => m.id === cap.id);
    if (!manifest) return null;
    return {
      id: manifest.department.toLowerCase().replace(' ', '_'),
      name: manifest.department,
      status: 'healthy',
      agents: manifest.workflows?.length || 0,
      packages: 1
    };
  }).filter(Boolean);

  res.json({
    descriptor,
    departments,
    installedPackages: descriptor.capabilities.map(c => c.id)
  });
});

app.get('/api/tenant/:id/knowledge-stats', async (req, res) => {
  try {
    // For now we count os_work_objects as documents
    const { count: docsCount, error: docsError } = await supabase
      .from('os_work_objects')
      .select('*', { count: 'exact', head: true });
      
    if (docsError) throw docsError;
    
    // Hardcode embeddings logic for now until vector db is fully up
    res.json({
      indexedDocuments: docsCount || 0,
      vectorEmbeddings: (docsCount || 0) * 15, // Approx embeddings per doc
      integrations: [
        { name: 'Google Workspace', desc: 'Sync Drive, Docs, and Gmail', status: 'Connected', type: 'google' },
        { name: 'Notion', desc: 'Import wikis and databases', status: 'Connect', type: 'notion' },
        { name: 'Slack', desc: 'Index public channel history', status: 'Connect', type: 'slack' },
        { name: 'Local File System', desc: 'Watch local folders for PDFs/CSV', status: 'Active', type: 'local' },
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/superintendent/chat', async (req, res) => {
  try {
    const { text, userId, tenantId } = req.body;
    if (!text || !userId || !tenantId) return res.status(400).json({ error: 'Missing parameters' });
    
    // Resolve the intent via the kernel
    const result = await IntentService.resolveIntent(text, userId, tenantId);
    
    res.json({
      role: 'ai',
      result,
      message: `Executing workflow: ${result.action}`
    });
  } catch (err: any) {
    console.error('Superintendent Chat Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 8787;
app.listen(PORT, () => {
  console.log(`Phase 1 TSX Search Server active on port ${PORT}`);
});
