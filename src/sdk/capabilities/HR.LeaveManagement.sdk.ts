/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Leave Management (HR.LeaveManagement)
 */

import { ICapabilityManifest } from '../types';

export const HRLeaveManagementSDK: ICapabilityManifest = {
  id: 'HR.LeaveManagement',
  name: 'Leave Management',
  description: 'Leave policy configuration, request workflows, approval chains, and leave balance tracking.',
  department: 'Human Resources',
  category: 'Recruitment & HR',
  version: '1.6.0',
  maturity: 'L4',
  icon: '🌴',
  rating: 4.6,
  installs: 16800,
  tags: ["leave","vacation","pto","hr"],

  objects: [
    {
      name: 'LeaveRequest',
      pluralName: 'Leave Requests',
      icon: '🌴',
      titleField: 'EmployeeName',
      statusField: 'Status',
      fields: [
        {
                name: "EmployeeName",
                label: "Employee",
                type: "user",
                required: true,
                filterable: true,
                width: "half"
        },
        {
                name: "LeaveType",
                label: "Leave Type",
                type: "enum",
                options: [
                        "Annual",
                        "Sick",
                        "Maternity",
                        "Paternity",
                        "Unpaid",
                        "Other"
                ],
                required: true,
                filterable: true,
                width: "half"
        },
        {
                name: "StartDate",
                label: "From",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "EndDate",
                label: "To",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Pending",
                        "Approved",
                        "Rejected",
                        "Cancelled"
                ],
                defaultValue: "Pending",
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
    { id: 'leaverequest', label: 'Leave Requests', icon: '🌴', type: 'grid', object: 'LeaveRequest' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Leave Management AI',
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
        key: "annual_leave_days",
        label: "Annual Leave Days",
        type: "number",
        defaultValue: 20,
        group: "Policy"
    },
    {
        key: "sick_leave_days",
        label: "Sick Leave Days",
        type: "number",
        defaultValue: 10,
        group: "Policy"
    }
],
  integrations: [],
  seed: { objects: [] }
};
