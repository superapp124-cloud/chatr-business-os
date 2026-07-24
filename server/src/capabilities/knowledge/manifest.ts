import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Knowledge.Base',
  name: 'Knowledge Base',
  description: 'Centralized company wiki with AI-powered search, version history, and collaborative editing.',
  department: 'Knowledge',
  category: 'Knowledge Management',
  version: '1.1.0',
  maturity: 'L4',
  icon: '📚',
  rating: 4.8,
  installs: 19200,
  verbs: ['create', 'update', 'search', 'archive', 'share'],
  nouns: ['article', 'document', 'wiki', 'guide', 'sop'],
  permissions: ['knowledge.article.create', 'knowledge.article.read'],
  eventsProduced: ['ArticlePublished', 'ArticleUpdated'],
  eventsConsumed: [],
  dependencies: [],
  search: ['title', 'content', 'category', 'author'],
  configSchema: [
    { key: 'public_access', label: 'Allow Public Access', type: 'boolean', defaultValue: false, group: 'Access' },
    { key: 'approval_workflow', label: 'Require Approval to Publish', type: 'boolean', defaultValue: true, group: 'Workflow' },
    { key: 'ai_suggestions', label: 'AI Content Suggestions', type: 'boolean', defaultValue: true, group: 'AI' },
    { key: 'comment_enabled', label: 'Enable Comments', type: 'boolean', defaultValue: true, group: 'Collaboration' },
    { key: 'categories', label: 'Article Categories', type: 'multiselect', defaultValue: ['General', 'HR Policy', 'Technical', 'Operations', 'Product'], group: 'Organization' },
  ],
  tags: ['knowledge', 'wiki', 'documentation', 'sop'],
};
export default manifest;
