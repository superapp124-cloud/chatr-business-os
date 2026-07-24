import { CapabilityManifest } from '../types';

export const taskManifest: CapabilityManifest = {
  id: 'core.task',
  name: 'Task Management',
  description: 'Manages actionable tasks with assignments and priorities',
  keywords: ['task', 'todo', 'action item', 'buy', 'get', 'pick up'],
  executionPolicy: 'requires_confirmation',
  requiredPermissions: [], // Local state
  supportedProviders: ['local.sqlite', 'dummy.provider'],
  schema: {
    title: { type: 'string', required: true },
    assignee: { type: 'string', required: false },
    priority: { type: 'string', required: false }, // 'low', 'medium', 'high'
    dueDate: { type: 'string', required: false }
  }
};
