/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Inventory Management (Operations.InventoryManagement)
 */

import { ICapabilityManifest } from '../types';

export const OperationsInventoryManagementSDK: ICapabilityManifest = {
  id: 'Operations.InventoryManagement',
  name: 'Inventory Management',
  description: 'Real-time inventory tracking with stock alerts, purchase suggestions, and multi-location support.',
  department: 'Operations',
  category: 'Operations',
  version: '1.7.0',
  maturity: 'L4',
  icon: '📦',
  rating: 4.6,
  installs: 14200,
  tags: ["inventory","stock","warehouse","operations"],

  objects: [
    {
      name: 'InventoryItem',
      pluralName: 'Inventory Items',
      icon: '📦',
      titleField: 'Name',
      statusField: '',
      fields: [
        {
                name: "Name",
                label: "Item Name",
                type: "string",
                required: true,
                searchable: true,
                sortable: true,
                width: "full"
        },
        {
                name: "SKU",
                label: "SKU",
                type: "string",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "Quantity",
                label: "Current Stock",
                type: "number",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "ReorderPoint",
                label: "Reorder Point",
                type: "number",
                required: true,
                width: "half"
        },
        {
                name: "Category",
                label: "Category",
                type: "string",
                filterable: true,
                width: "half"
        },
        {
                name: "Location",
                label: "Storage Location",
                type: "string",
                filterable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'inventoryitem', label: 'Inventory Items', icon: '📦', type: 'grid', object: 'InventoryItem' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Inventory Management AI',
    skills: []
  },
  
  // ABI v1.0: Intelligence & Execution
  stateMachines: [],
  policies: [],
  agents: [],
  tools: [],
  workflows: [],
  automations: [],
  notifications: [],
  permissions: {},
  search: { objects: [] },
  settings: [
    {
        key: "low_stock_threshold",
        label: "Low Stock Alert at (%)",
        type: "number",
        defaultValue: 20,
        group: "Alerts"
    }
],
  integrations: [],
  seed: { objects: [] }
};
