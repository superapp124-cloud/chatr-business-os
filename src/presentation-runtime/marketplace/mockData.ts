import { CapabilityPack, Industry, IndustryTemplate } from './models';

export const MOCK_PACKS: CapabilityPack[] = [
  {
    id: 'pack-identity',
    name: 'Identity & Access Management',
    version: '1.0.0',
    category: 'Enterprise Foundation',
    description: 'Centralized authentication, authorization, and tenant isolation.',
    dependencies: [],
    permissions: ['*'],
    objects: ['User', 'Role', 'Tenant'],
    processes: ['UserOnboarding'],
    policies: ['RBACPolicy'],
    previewImages: [],
    author: 'CHATR Core Team',
    certification: 'Verified',
    status: 'Available'
  },
  {
    id: 'pack-workflow',
    name: 'Workflow Engine',
    version: '1.2.0',
    category: 'Enterprise Foundation',
    description: 'Declarative BPMN-style workflows for document routing and approvals.',
    dependencies: ['pack-identity'],
    permissions: ['workflow:create', 'workflow:execute'],
    objects: ['Workflow', 'Task'],
    processes: ['ApprovalProcess'],
    policies: [],
    previewImages: [],
    author: 'CHATR Core Team',
    certification: 'Verified',
    status: 'Available'
  },
  {
    id: 'pack-crm',
    name: 'CRM Core',
    version: '2.1.0',
    category: 'Business Operations',
    description: 'Manage leads, opportunities, accounts, and contacts.',
    dependencies: ['pack-identity', 'pack-workflow'],
    permissions: ['crm:read', 'crm:write'],
    objects: ['Lead', 'Opportunity', 'Account', 'Contact'],
    processes: ['LeadConversion'],
    policies: ['DataPrivacyPolicy'],
    previewImages: [],
    author: 'CHATR Business Solutions',
    certification: 'Verified',
    status: 'Available'
  },
  {
    id: 'pack-ats',
    name: 'Applicant Tracking System (ATS)',
    version: '1.0.0',
    category: 'Recruitment',
    description: 'End-to-end recruitment pipelines, resume parsing, and interview scheduling.',
    dependencies: ['pack-identity', 'pack-workflow'],
    permissions: ['recruitment:read', 'recruitment:write'],
    objects: ['Candidate', 'JobReq', 'Application', 'Interview'],
    processes: ['HiringPipeline'],
    policies: ['EEOCompliancePolicy'],
    previewImages: [],
    author: 'CHATR HR Team',
    certification: 'Verified',
    status: 'Available'
  },
  {
    id: 'pack-itsm',
    name: 'IT Service Management (ITSM)',
    version: '3.0.0',
    category: 'Technology Operations',
    description: 'ITIL-aligned service desk, incident management, and problem management.',
    dependencies: ['pack-identity', 'pack-workflow'],
    permissions: ['itsm:agent', 'itsm:admin'],
    objects: ['Ticket', 'Incident', 'Problem', 'ChangeRequest'],
    processes: ['IncidentResolution', 'ChangeApproval'],
    policies: ['SLA_Policy'],
    previewImages: [],
    author: 'CHATR IT Solutions',
    certification: 'Verified',
    status: 'Available'
  },
  {
    id: 'pack-emr',
    name: 'Electronic Medical Records (EMR)',
    version: '1.0.0',
    category: 'Healthcare',
    description: 'Patient records, charts, and clinical history.',
    dependencies: ['pack-identity', 'pack-workflow'],
    permissions: ['clinical:read', 'clinical:write'],
    objects: ['Patient', 'Encounter', 'ClinicalNote'],
    processes: ['PatientAdmit', 'PatientDischarge'],
    policies: ['HIPAA_Policy'],
    previewImages: [],
    author: 'CHATR Health',
    certification: 'Verified',
    status: 'Available'
  }
];

export const MOCK_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'tpl-it-ops',
    industryId: 'ind-it',
    name: 'IT Operations Platform',
    description: 'A complete suite for internal IT service delivery, CMDB, and helpdesk.',
    packs: ['pack-identity', 'pack-workflow', 'pack-itsm'],
    icon: '💻'
  },
  {
    id: 'tpl-recruitment-suite',
    industryId: 'ind-recruitment',
    name: 'Enterprise Recruitment Suite',
    description: 'Everything you need to source, track, and hire top talent.',
    packs: ['pack-identity', 'pack-workflow', 'pack-ats'],
    icon: '👥'
  },
  {
    id: 'tpl-hospital-suite',
    industryId: 'ind-healthcare',
    name: 'Hospital Management Suite',
    description: 'Comprehensive clinical and administrative workflows for modern hospitals.',
    packs: ['pack-identity', 'pack-workflow', 'pack-emr'],
    icon: '🏥'
  }
];

export const MOCK_INDUSTRIES: Industry[] = [
  {
    id: 'ind-it',
    name: 'Information Technology',
    description: 'Build a complete IT Operations Platform (ITSM, CMDB, DevOps).',
    icon: '💻',
    templates: ['tpl-it-ops'],
    packCount: 20
  },
  {
    id: 'ind-recruitment',
    name: 'Recruitment & Talent',
    description: 'Build a complete ATS & HR Platform with AI Matching.',
    icon: '👥',
    templates: ['tpl-recruitment-suite'],
    packCount: 16
  },
  {
    id: 'ind-healthcare',
    name: 'Healthcare',
    description: 'Build a Hospital Management Platform with EMR and Billing.',
    icon: '🏥',
    templates: ['tpl-hospital-suite'],
    packCount: 18
  },
  {
    id: 'ind-manufacturing',
    name: 'Manufacturing',
    description: 'Production planning, MES, and quality control.',
    icon: '🏭',
    templates: [],
    packCount: 22
  },
  {
    id: 'ind-banking',
    name: 'Banking',
    description: 'Core banking operations, compliance, and loans.',
    icon: '💰',
    templates: [],
    packCount: 15
  },
  {
    id: 'ind-logistics',
    name: 'Logistics',
    description: 'Fleet, warehouse, and supply chain operations.',
    icon: '🚚',
    templates: [],
    packCount: 14
  }
];
