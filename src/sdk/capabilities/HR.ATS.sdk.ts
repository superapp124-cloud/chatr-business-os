/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Applicant Tracking (HR.ATS)
 */

import { ICapabilityManifest } from '../types';

export const HRATSSDK: ICapabilityManifest = {
  id: 'HR.ATS',
  name: 'Applicant Tracking',
  description: 'End-to-end recruitment pipeline with job postings, candidate tracking, interview scheduling, and offer management.',
  department: 'Human Resources',
  category: 'Recruitment & HR',
  version: '2.0.0',
  maturity: 'L5',
  icon: '📋',
  rating: 4.8,
  installs: 18700,
  tags: ["ats","recruitment","hiring","candidates"],

  objects: [
    {
      name: 'JobRequisition',
      pluralName: 'Job Requisitions',
      icon: '📋',
      titleField: 'Title',
      statusField: 'Status',
      fields: [
        {
                name: "Title",
                label: "Job Title",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Department",
                label: "Department",
                type: "string",
                filterable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Open",
                        "Interviewing",
                        "Offer Sent",
                        "Closed",
                        "On Hold"
                ],
                defaultValue: "Open",
                filterable: true,
                width: "half"
        },
        {
                name: "HiringManager",
                label: "Hiring Manager",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "OpenDate",
                label: "Open Date",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "Applications",
                label: "Total Applications",
                type: "number",
                readonly: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    },

    {
      name: 'Candidate',
      pluralName: 'Candidates',
      icon: '👤',
      titleField: 'Name',
      statusField: 'Stage',
      fields: [
        {
                name: "Name",
                label: "Candidate Name",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Email",
                label: "Email",
                type: "string",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "Stage",
                label: "Pipeline Stage",
                type: "enum",
                options: [
                        "Applied",
                        "Screening",
                        "Interview",
                        "Offer",
                        "Hired",
                        "Rejected"
                ],
                defaultValue: "Applied",
                filterable: true,
                width: "half"
        },
        {
                name: "JobRequisition",
                label: "Applied For",
                type: "reference",
                referenceTo: "JobRequisition",
                filterable: true,
                width: "full"
        },
        {
                name: "Recruiter",
                label: "Recruiter",
                type: "user",
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
    { id: 'jobrequisition', label: 'Job Requisitions', icon: '📋', type: 'grid', object: 'JobRequisition' },
    { id: 'candidate', label: 'Candidates', icon: '👤', type: 'grid', object: 'Candidate' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Applicant Tracking AI',
    skills: []
  },
  
  // ABI v1.0: Strict Object Lifecycles
  stateMachines: [
    {
      objectId: 'Candidate',
      initialState: 'Applied',
      states: {
        'Applied': { transitions: { 'Screen': 'Screening', 'Reject': 'Rejected' } },
        'Screening': { transitions: { 'Pass': 'Interview', 'Fail': 'Rejected' } },
        'Interview': { transitions: { 'Select': 'Offer', 'Reject': 'Rejected' } },
        'Offer': { transitions: { 'Accept': 'Accepted', 'Decline': 'Rejected' } },
        'Accepted': { transitions: { 'Join': 'Joined', 'NoShow': 'Rejected' } },
        'Joined': { transitions: {} },
        'Rejected': { transitions: {} }
      }
    }
  ],

  // ABI v1.0: Strict Business Policies
  policies: [
    {
      id: 'POL-ATS-001',
      object: 'Candidate',
      condition: 'Status == Offer',
      decision: 'RequireApproval',
      effect: { role: 'Hiring Manager', action: 'Approve Offer Compensation' }
    }
  ],

  workflows: [
    {
      id: 'wf_send_offer',
      label: 'Send Offer to Candidate',
      trigger: 'on-status-change',
      triggerObject: 'Candidate',
      triggerConditions: [{ field: 'Stage', operator: 'eq', value: 'Offer' }],
      steps: [
        { id: 's1', type: 'action', label: 'Generate Offer Document', config: { toolId: 'generateOfferLetter' } },
        { id: 's2', type: 'notification', label: 'Notify Recruiter', config: { template: 'offer_ready' } }
      ]
    }
  ],
  
  agents: [
    {
      id: 'agent_recruiter',
      role: 'ATS Recruiter Agent',
      goal: 'Manage the candidate pipeline, schedule interviews, and draft offer letters.',
      memory: 'Business',
      permissions: ['Candidate.Write', 'JobRequisition.Read'],
      tools: ['generateOfferLetter'],
      SOP: 'Candidate Lifecycle',
      policies: ['POL-ATS-001'],
      workflows: ['wf_send_offer'],
      knowledge: ['Recruitment Guidelines']
    }
  ],

  tools: [
    {
      id: 'generateOfferLetter',
      name: 'Generate Offer Letter',
      description: 'Creates a formal offer letter document based on candidate and job details.',
      inputs: {
        type: 'object',
        properties: {
          candidateId: { type: 'string' },
          salary: { type: 'number' }
        }
      },
      outputs: { type: 'object' },
      permissions: ['Candidate.Write'],
      sideEffects: true
    }
  ],

  automations: [],
  notifications: [],
  permissions: {},
  search: { objects: [] },
  settings: [
    {
        key: "careers_page_url",
        label: "Careers Page URL",
        type: "url",
        defaultValue: "",
        group: "Branding"
    },
    {
        key: "auto_screen_resumes",
        label: "AI Resume Screening",
        type: "boolean",
        defaultValue: true,
        group: "AI"
    }
],
  integrations: [],
  seed: { objects: [] }
};
