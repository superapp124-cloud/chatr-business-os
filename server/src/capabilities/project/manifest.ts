import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Operations.ProjectManager',
  name: 'Project Manager',
  description: 'Full project lifecycle management with Gantt charts, task dependencies, milestones, and team workload.',
  department: 'Operations',
  category: 'Project Management',
  version: '2.0.0',
  maturity: 'L5',
  icon: '📊',
  rating: 4.8,
  installs: 31000,
  verbs: ['create', 'assign', 'track', 'update', 'complete', 'archive'],
  nouns: ['project', 'task', 'milestone', 'sprint', 'epic'],
  permissions: ['operations.project.create', 'operations.task.assign'],
  eventsProduced: ['ProjectCreated', 'TaskCompleted', 'MilestoneReached'],
  eventsConsumed: [],
  dependencies: [],
  search: ['name', 'description', 'assignee', 'status', 'deadline'],
  configSchema: [
    { key: 'methodology', label: 'Project Methodology', type: 'select', defaultValue: 'Agile', options: ['Agile', 'Waterfall', 'Kanban', 'Scrum', 'Hybrid'], group: 'Methodology' },
    { key: 'default_sprint_length', label: 'Sprint Length (days)', type: 'number', defaultValue: 14, group: 'Sprints' },
    { key: 'enable_time_tracking', label: 'Time Tracking', type: 'boolean', defaultValue: true, group: 'Tracking' },
    { key: 'working_days', label: 'Working Days', type: 'multiselect', defaultValue: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], group: 'Schedule' },
    { key: 'burndown_chart', label: 'Show Burndown Chart', type: 'boolean', defaultValue: true, group: 'Reporting' },
  ],
  tags: ['project', 'tasks', 'agile', 'gantt', 'scrum'],
};
export default manifest;
