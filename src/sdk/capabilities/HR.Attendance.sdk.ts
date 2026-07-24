/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Attendance (HR.Attendance)
 */

import { ICapabilityManifest } from '../types';

export const HRAttendanceSDK: ICapabilityManifest = {
  id: 'HR.Attendance',
  name: 'Attendance',
  description: 'Time tracking, shift scheduling, overtime management, and biometric integration.',
  department: 'Human Resources',
  category: 'Recruitment & HR',
  version: '1.7.0',
  maturity: 'L4',
  icon: '🕐',
  rating: 4.5,
  installs: 14200,
  tags: ["attendance","timekeeping","shifts","payroll"],

  objects: [
    {
      name: 'AttendanceRecord',
      pluralName: 'Attendance Records',
      icon: '🕐',
      titleField: 'EmployeeName',
      statusField: '',
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
                name: "Date",
                label: "Date",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "ClockIn",
                label: "Clock In",
                type: "string",
                width: "half"
        },
        {
                name: "ClockOut",
                label: "Clock Out",
                type: "string",
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Present",
                        "Absent",
                        "Late",
                        "Half Day",
                        "Holiday"
                ],
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
    { id: 'attendancerecord', label: 'Attendance Records', icon: '🕐', type: 'grid', object: 'AttendanceRecord' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Attendance AI',
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
        key: "work_hours",
        label: "Standard Work Hours/Day",
        type: "number",
        defaultValue: 8,
        group: "Schedule"
    },
    {
        key: "overtime_threshold",
        label: "Overtime After (hours)",
        type: "number",
        defaultValue: 40,
        group: "Overtime"
    }
],
  integrations: [],
  seed: { objects: [] }
};
