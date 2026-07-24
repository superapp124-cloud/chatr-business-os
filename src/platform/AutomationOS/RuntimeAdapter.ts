
import { ExecutionGraph, ExecutionTask, ExecutionContext } from './Types';
import { EventBus } from './EventBus';
import { generate } from '@/services/ai';
import { supabase } from '@/integrations/supabase/client';

const executors: Record<string, (data: Record<string, any>) => Promise<Record<string, any>>> = {
  'core.trigger': async (data) => {
    return { triggered: true, timestamp: Date.now(), payload: data };
  },
  'core.ai_agent': async (data) => {
    const prompt = data.prompt || data.label || 'Process the workflow step.';
    try {
      const response = await generate({ prompt });
      return { response, model: 'local', success: true };
    } catch (err: any) {
      throw new Error(`AI Agent failed: ${err.message}`);
    }
  },
  'core.email': async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from as any)('email_queue').insert({
      to_address: data.to || data.recipient || user?.email,
      subject: data.subject || 'CHATR Automation',
      body: data.body || data.content || '',
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: { source: 'automation_os', ...data },
    });
    if (error) throw new Error(`Email queue insert failed: ${error.message}`);
    return { queued: true, to: data.to, subject: data.subject };
  },
  'core.webhook': async (data) => {
    const url = data.url || data.endpoint;
    if (!url) throw new Error('Webhook node missing url property');
    const response = await fetch(url, {
      method: data.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(data.headers || {}) },
      body: data.body ? JSON.stringify(data.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    return { status: response.status, body };
  },
  'core.condition': async (data) => {
    const expression = data.expression || data.condition || 'true';
    const sanitized = expression.replace(/[^a-zA-Z0-9_.=!<>'"& |()]/g, '');
    let result = false;
    try { result = Boolean(new Function('return ' + sanitized)()); } catch { result = false; }
    return { result, branch: result ? 'true' : 'false' };
  },
  'core.notification': async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated for notifications');
    const { error } = await (supabase.from as any)('notifications').insert({
      user_id: user.id,
      type: 'automation',
      title: data.title || 'Automation Complete',
      body: data.message || data.body || 'A workflow step completed.',
      metadata: data,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Notification insert failed: ${error.message}`);
    return { notified: true, userId: user.id };
  },
  'core.database': async (data) => {
    const { table, operation = 'select', filters = {}, payload = {} } = data;
    if (!table) throw new Error('Database node missing table property');
    const query = (supabase.from as any)(table);
    if (operation === 'select') {
      const { data: rows, error } = await query.select('*').match(filters).limit(50);
      if (error) throw new Error(error.message);
      return { rows, count: rows?.length || 0 };
    } else if (operation === 'insert') {
      const { data: inserted, error } = await query.insert(payload).select();
      if (error) throw new Error(error.message);
      return { inserted };
    }
    throw new Error(`Unknown database operation: ${operation}`);
  },
};

const unknownExecutor = async (type: string, data: Record<string, any>) => {
  console.warn(`[RuntimeAdapter] No executor for type "${type}"`);
  return { executed: false, type, reason: 'No executor registered', inputs: data };
};

export class LocalBrowserRuntime {
  private context: ExecutionContext = {};

  async execute(graph: ExecutionGraph, workflowId: string): Promise<void> {
    EventBus.publish({ type: 'EXECUTION_STARTED', payload: { workflowId }, timestamp: Date.now() });
    this.context = {};

    const tasksByOrder: Record<number, ExecutionTask[]> = {};
    graph.tasks.forEach(t => {
      if (!tasksByOrder[t.runOrder]) tasksByOrder[t.runOrder] = [];
      tasksByOrder[t.runOrder].push(t);
    });

    const maxOrder = Math.max(...graph.tasks.map(t => t.runOrder));

    for (let currentOrder = 0; currentOrder <= maxOrder; currentOrder++) {
      const tasksToRun = tasksByOrder[currentOrder] || [];
      await Promise.all(tasksToRun.map(task => this.executeTask(task, workflowId)));
    }

    EventBus.publish({ type: 'EXECUTION_COMPLETED', payload: { workflowId, context: this.context }, timestamp: Date.now() });
  }

  private async executeTask(task: ExecutionTask, workflowId: string): Promise<void> {
    EventBus.publish({ type: 'NODE_STARTED', payload: { workflowId, nodeId: task.nodeId }, timestamp: Date.now() });
    try {
      const resolvedData = this.interpolateVariables(task.data);
      const executor = executors[task.type];
      const output = executor
        ? await executor(resolvedData)
        : await unknownExecutor(task.type, resolvedData);
      this.context[task.nodeId] = { status: 'success', output };
      EventBus.publish({ type: 'NODE_COMPLETED', payload: { workflowId, nodeId: task.nodeId, output }, timestamp: Date.now() });
    } catch (error: any) {
      this.context[task.nodeId] = { status: 'failed', output: error.message };
      EventBus.publish({ type: 'NODE_FAILED', payload: { workflowId, nodeId: task.nodeId, error: error.message }, timestamp: Date.now() });
      throw error;
    }
  }

  private interpolateVariables(data: Record<string, any>): Record<string, any> {
    const resolved = { ...data };
    const regex = /\{\{([^}]+)\}\}/g;
    for (const key in resolved) {
      if (typeof resolved[key] === 'string') {
        resolved[key] = resolved[key].replace(regex, (match, path) => {
          const parts = path.trim().split('.');
          const nodeId = parts[0];
          if (this.context[nodeId] && this.context[nodeId].status === 'success') {
            let val: any = this.context[nodeId];
            for (let i = 1; i < parts.length; i++) {
              if (val === undefined) break;
              val = val[parts[i]];
            }
            return val !== undefined ? String(val) : match;
          }
          return match;
        });
      }
    }
    return resolved;
  }
}

export const RuntimeAdapter = new LocalBrowserRuntime();
