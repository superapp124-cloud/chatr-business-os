import { CapabilityManifest } from './Types';

class Registry {
  private capabilities: Map<string, CapabilityManifest> = new Map();
  register(manifest: CapabilityManifest) {
    this.capabilities.set(manifest.id, manifest);
    console.log(`[CapabilityRegistry] Registered capability: ${manifest.id} v1.0.0`);
  }
  get(id: string): CapabilityManifest | undefined { return this.capabilities.get(id); }
  getAll(): CapabilityManifest[] { return Array.from(this.capabilities.values()); }
}

export const CapabilityRegistry = new Registry();

CapabilityRegistry.register({ id: 'core.trigger', label: 'Trigger', icon: 'zap', category: 'Core', description: 'Starts a workflow', inputs: {}, outputs: { triggered: 'boolean', timestamp: 'number', payload: 'any' }, propertySchema: {} });
CapabilityRegistry.register({ id: 'core.ai_agent', label: 'AI Agent', icon: 'bot', category: 'AI', description: 'Executes a prompt via the local LLM (Ollama or CHATR Kernel)', inputs: { prompt: 'string' }, outputs: { response: 'string', model: 'string' }, propertySchema: { prompt: { type: 'string', required: true } } });
CapabilityRegistry.register({ id: 'core.email', label: 'Send Email', icon: 'mail', category: 'Communication', description: 'Queues an email via email_queue table', inputs: { to: 'string', subject: 'string', body: 'string' }, outputs: { queued: 'boolean' }, propertySchema: { to: { type: 'string', required: true }, subject: { type: 'string', required: true }, body: { type: 'string', required: true } } });
CapabilityRegistry.register({ id: 'core.webhook', label: 'HTTP Request', icon: 'globe', category: 'Integration', description: 'Makes a real outbound HTTP request', inputs: { url: 'string', method: 'string', headers: 'object', body: 'any' }, outputs: { status: 'number', body: 'any' }, propertySchema: { url: { type: 'string', required: true }, method: { type: 'string', default: 'POST' } } });
CapabilityRegistry.register({ id: 'core.condition', label: 'Condition', icon: 'git-branch', category: 'Logic', description: 'Evaluates a boolean expression', inputs: { expression: 'string' }, outputs: { result: 'boolean', branch: 'string' }, propertySchema: { expression: { type: 'string', required: true } } });
CapabilityRegistry.register({ id: 'core.notification', label: 'Send Notification', icon: 'bell', category: 'Communication', description: 'Pushes a notification to the OS notification center', inputs: { title: 'string', message: 'string' }, outputs: { notified: 'boolean' }, propertySchema: { title: { type: 'string', required: true }, message: { type: 'string', required: true } } });
CapabilityRegistry.register({ id: 'core.database', label: 'Database', icon: 'database', category: 'Data', description: 'Reads, writes, or updates rows in a Supabase table', inputs: { table: 'string', operation: 'string', filters: 'object', payload: 'object' }, outputs: { rows: 'array', count: 'number', inserted: 'object' }, propertySchema: { table: { type: 'string', required: true }, operation: { type: 'string', default: 'select' } } });
