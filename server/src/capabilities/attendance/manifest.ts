import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'HR.Attendance',
  name: 'Attendance & Leave',
  description: 'Track employee attendance, manage leave requests, holiday calendars, and overtime reports.',
  department: 'HR',
  category: 'HR & People',
  version: '1.1.0',
  maturity: 'L4',
  icon: '📅',
  rating: 4.6,
  installs: 9400,
  verbs: ['clock', 'request', 'approve', 'reject', 'track'],
  nouns: ['attendance', 'leave', 'holiday', 'overtime', 'shift'],
  permissions: ['hr.attendance.view', 'hr.leave.approve'],
  eventsProduced: ['LeaveApproved', 'AttendanceMarked'],
  eventsConsumed: [],
  dependencies: [],
  search: ['employee', 'date', 'leave_type', 'status'],
  configSchema: [
    { key: 'work_hours_per_day', label: 'Work Hours/Day', type: 'number', defaultValue: 8, group: 'Schedule' },
    { key: 'leave_types', label: 'Leave Types', type: 'multiselect', defaultValue: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid'], group: 'Leave' },
    { key: 'approval_required', label: 'Leave Approval Required', type: 'boolean', defaultValue: true, group: 'Workflow' },
    { key: 'geofencing', label: 'Enable Geo-fencing', type: 'boolean', defaultValue: false, description: 'Restrict clock-in to office location', group: 'Tracking' },
  ],
  tags: ['hr', 'attendance', 'leave', 'timekeeping'],
};
export default manifest;
