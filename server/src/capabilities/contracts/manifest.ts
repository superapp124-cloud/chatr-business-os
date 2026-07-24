import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Legal.Contracts',
  name: 'Contract Management',
  description: 'Draft, negotiate, e-sign, and manage contract lifecycle with expiry alerts and obligation tracking.',
  department: 'Legal',
  category: 'Legal & Compliance',
  version: '1.0.0',
  maturity: 'L4',
  icon: '📝',
  rating: 4.7,
  installs: 4100,
  verbs: ['draft', 'review', 'sign', 'renew', 'terminate'],
  nouns: ['contract', 'agreement', 'clause', 'obligation', 'renewal'],
  permissions: ['legal.contract.create', 'legal.contract.sign'],
  eventsProduced: ['ContractSigned', 'ContractExpiring'],
  eventsConsumed: [],
  dependencies: [],
  search: ['party', 'type', 'status', 'expiry'],
  configSchema: [
    { key: 'esign_provider', label: 'E-Sign Provider', type: 'select', defaultValue: 'Internal', options: ['Internal', 'DocuSign', 'HelloSign'], group: 'Signing' },
    { key: 'expiry_alert_days', label: 'Expiry Alert (days before)', type: 'number', defaultValue: 30, group: 'Alerts' },
    { key: 'version_control', label: 'Enable Version Control', type: 'boolean', defaultValue: true, group: 'Documents' },
    { key: 'mandatory_review', label: 'Mandatory Legal Review', type: 'boolean', defaultValue: true, group: 'Workflow' },
  ],
  tags: ['legal', 'contracts', 'esign', 'compliance'],
};
export default manifest;
