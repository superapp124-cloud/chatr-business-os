import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Operations.Inventory',
  name: 'Inventory Management',
  description: 'Real-time stock tracking, low-stock alerts, supplier reorders, and warehouse location mapping.',
  department: 'Operations',
  category: 'Operations',
  version: '1.1.0',
  maturity: 'L4',
  icon: '📦',
  rating: 4.6,
  installs: 7800,
  verbs: ['add', 'remove', 'reorder', 'transfer', 'audit'],
  nouns: ['inventory', 'stock', 'product', 'warehouse', 'sku'],
  permissions: ['operations.inventory.read', 'operations.inventory.update'],
  eventsProduced: ['StockLow', 'ReorderTriggered', 'InventoryUpdated'],
  eventsConsumed: [],
  dependencies: [],
  search: ['sku', 'product', 'warehouse', 'supplier'],
  configSchema: [
    { key: 'low_stock_threshold', label: 'Low Stock Threshold', type: 'number', defaultValue: 10, group: 'Alerts' },
    { key: 'auto_reorder', label: 'Enable Auto-Reorder', type: 'boolean', defaultValue: true, group: 'Automation' },
    { key: 'reorder_quantity', label: 'Default Reorder Quantity', type: 'number', defaultValue: 100, group: 'Automation' },
    { key: 'track_batches', label: 'Batch/Lot Tracking', type: 'boolean', defaultValue: false, group: 'Tracking' },
    { key: 'valuation_method', label: 'Valuation Method', type: 'select', defaultValue: 'FIFO', options: ['FIFO', 'LIFO', 'Average Cost'], group: 'Accounting' },
  ],
  tags: ['inventory', 'warehouse', 'stock', 'operations'],
};
export default manifest;
