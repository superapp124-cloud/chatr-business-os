/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Purchase Orders (Finance.PurchaseOrders)
 */

import { ICapabilityManifest } from '../types';

export const FinancePurchaseOrdersSDK: ICapabilityManifest = {
  id: 'Finance.PurchaseOrders',
  name: 'Purchase Orders',
  description: 'Purchase order management with vendor catalog, approval workflows, receiving, and three-way matching.',
  department: 'Finance',
  category: 'Finance',
  version: '1.6.0',
  maturity: 'L4',
  icon: '📦',
  rating: 4.6,
  installs: 12800,
  tags: ["procurement","purchase-orders","vendors","finance"],

  objects: [
    {
      name: 'PurchaseOrder',
      pluralName: 'Purchase Orders',
      icon: '📦',
      titleField: 'PONumber',
      statusField: 'Status',
      fields: [
        {
                name: "PONumber",
                label: "PO Number",
                type: "string",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "Vendor",
                label: "Vendor",
                type: "string",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "TotalValue",
                label: "Total Value ($)",
                type: "number",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Draft",
                        "Pending Approval",
                        "Approved",
                        "Delivered",
                        "Cancelled"
                ],
                defaultValue: "Draft",
                filterable: true,
                width: "half"
        },
        {
                name: "OrderDate",
                label: "Order Date",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'purchaseorder', label: 'Purchase Orders', icon: '📦', type: 'grid', object: 'PurchaseOrder' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Purchase Orders AI',
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
        key: "po_approval_limit",
        label: "Approval Required Above ($)",
        type: "number",
        defaultValue: 5000,
        group: "Approvals"
    }
],
  integrations: [],
  seed: { objects: [] }
};
