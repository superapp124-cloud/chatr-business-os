import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Recruitment.ATS',
  name: 'Applicant Tracking System',
  description: 'End-to-end hiring pipeline with job postings, candidate tracking, interview scheduling, and offer management.',
  department: 'HR',
  category: 'HR & People',
  version: '1.0.0',
  maturity: 'L4',
  icon: '👥',
  rating: 4.7,
  installs: 8300,
  verbs: ['post', 'track', 'screen', 'interview', 'hire', 'reject'],
  nouns: ['candidate', 'job', 'application', 'interview', 'offer'],
  permissions: ['hr.candidate.create', 'hr.candidate.read', 'hr.job.create'],
  eventsProduced: ['CandidateApplied', 'CandidateHired'],
  eventsConsumed: [],
  dependencies: [],
  search: ['name', 'position', 'status', 'skills'],
  configSchema: [
    { key: 'hiring_stages', label: 'Hiring Stages', type: 'multiselect', defaultValue: ['Applied', 'Phone Screen', 'Technical', 'Final Round', 'Offer', 'Hired', 'Rejected'], group: 'Pipeline' },
    { key: 'auto_reject_days', label: 'Auto-reject After (days)', type: 'number', defaultValue: 30, group: 'Automation' },
    { key: 'interview_reminder_hours', label: 'Interview Reminder (hours)', type: 'number', defaultValue: 24, group: 'Notifications' },
    { key: 'default_job_board', label: 'Default Job Board', type: 'select', defaultValue: 'Internal', options: ['Internal', 'LinkedIn', 'Indeed', 'Naukri'], group: 'Posting' },
  ],
  tags: ['hr', 'recruiting', 'hiring', 'ats', 'candidates'],
};
export default manifest;
