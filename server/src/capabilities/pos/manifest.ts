import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Retail.POS',
  name: 'Point of Sale',
  description: 'Fast checkout with barcode scanning, multiple payment methods, receipt printing, and daily reconciliation.',
  department: 'Operations',
  category: 'Retail & Commerce',
  version: '1.0.0',
  maturity: 'L4',
  icon: '🛒',
  rating: 4.5,
  installs: 6700,
  verbs: ['sell', 'refund', 'discount', 'checkout', 'reconcile'],
  nouns: ['sale', 'transaction', 'receipt', 'product', 'payment'],
  permissions: ['retail.pos.sell', 'retail.pos.refund'],
  eventsProduced: ['SaleCompleted', 'RefundProcessed'],
  eventsConsumed: ['InventoryUpdated'],
  dependencies: ['Operations.Inventory'],
  search: ['transaction_id', 'product', 'cashier', 'date'],
  configSchema: [
    { key: 'payment_methods', label: 'Payment Methods', type: 'multiselect', defaultValue: ['Cash', 'Card', 'UPI'], options: ['Cash', 'Card', 'UPI', 'Net Banking', 'EMI'], group: 'Payments' },
    { key: 'tax_inclusive', label: 'Tax-Inclusive Pricing', type: 'boolean', defaultValue: true, group: 'Tax' },
    { key: 'print_receipt', label: 'Auto-Print Receipt', type: 'boolean', defaultValue: false, group: 'Printing' },
    { key: 'tip_enabled', label: 'Enable Tips', type: 'boolean', defaultValue: false, group: 'Checkout' },
  ],
  tags: ['retail', 'pos', 'sales', 'payments'],
};
export default manifest;
