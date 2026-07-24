import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'CRM.ContactManager',
  name: 'Contact Manager',
  description: 'Centralized contact database with relationship mapping, interaction history, and smart segmentation.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '1.2.0',
  maturity: 'L5',
  icon: '📇',
  rating: 4.9,
  installs: 22000,
  verbs: ['add', 'update', 'merge', 'segment', 'export'],
  nouns: ['contact', 'customer', 'account', 'company'],
  permissions: ['crm.contact.create', 'crm.contact.read', 'crm.contact.update', 'crm.contact.delete'],
  eventsProduced: ['ContactCreated', 'ContactUpdated'],
  eventsConsumed: ['LeadCreated'],
  dependencies: [],
  search: ['name', 'email', 'phone', 'company', 'tags'],
  configSchema: [
    { key: 'duplicate_detection', label: 'Duplicate Detection', type: 'boolean', defaultValue: true, group: 'Data Quality' },
    { key: 'custom_fields', label: 'Custom Fields', type: 'text', defaultValue: '', description: 'Comma-separated custom field names', group: 'Fields' },
    { key: 'default_owner', label: 'Default Owner', type: 'text', defaultValue: '', description: 'Default team member for new contacts', group: 'Assignment' },
    { key: 'contact_scoring', label: 'Enable Contact Scoring', type: 'boolean', defaultValue: true, group: 'Scoring' },
    { key: 'gdpr_mode', label: 'GDPR Compliance Mode', type: 'boolean', defaultValue: false, group: 'Compliance' },
  ],
  tags: ['crm', 'contacts', 'customers', 'relationships'],
};
export default manifest;
