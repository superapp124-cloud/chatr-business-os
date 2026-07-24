const fs = require('fs');
const path = require('path');

const CAPABILITIES_DIR = path.join(__dirname, '../src/core/capabilities');

const core15 = [
  // Personal Productivity
  { id: 'core.task', name: 'Task', category: 'productivity', outcomeType: 'CREATE', providerName: 'PersistenceProvider' },
  { id: 'core.note', name: 'Note', category: 'productivity', outcomeType: 'CREATE', providerName: 'PersistenceProvider' },
  { id: 'core.checklist', name: 'Checklist', category: 'productivity', outcomeType: 'CREATE', providerName: 'PersistenceProvider' },
  { id: 'core.follow_up', name: 'Follow-up', category: 'productivity', outcomeType: 'SCHEDULE', providerName: 'PersistenceProvider' },

  // Communication
  { id: 'core.call', name: 'Call', category: 'communication', outcomeType: 'COMMUNICATE', providerName: 'CommunicationProvider' },
  { id: 'core.email', name: 'Email', category: 'communication', outcomeType: 'COMMUNICATE', providerName: 'CommunicationProvider' },
  { id: 'core.contact', name: 'Contact', category: 'communication', outcomeType: 'CREATE', providerName: 'ContactProvider' },

  // Collaboration
  { id: 'core.meeting', name: 'Meeting', category: 'collaboration', outcomeType: 'SCHEDULE', providerName: 'CalendarProvider' },
  { id: 'core.calendar_event', name: 'Calendar Event', category: 'collaboration', outcomeType: 'SCHEDULE', providerName: 'CalendarProvider' },
  { id: 'core.document', name: 'Document', category: 'collaboration', outcomeType: 'CREATE', providerName: 'DocumentProvider' },

  // Business
  { id: 'core.candidate_interview', name: 'Candidate Interview', category: 'business', outcomeType: 'SCHEDULE', providerName: 'HRProvider' },
  { id: 'core.expense', name: 'Expense', category: 'business', outcomeType: 'CREATE', providerName: 'FinanceProvider' },

  // Travel
  { id: 'core.flight_booking', name: 'Flight Booking', category: 'travel', outcomeType: 'CREATE', providerName: 'TravelProvider' },
  { id: 'core.hotel_booking', name: 'Hotel Booking', category: 'travel', outcomeType: 'CREATE', providerName: 'TravelProvider' },
];

function generateManifest(cap) {
  return JSON.stringify({
    id: cap.id,
    name: cap.name,
    version: "1.0.0",
    category: cap.category,
    outcomeType: cap.outcomeType,
    providerName: cap.providerName,
    maxExecutionTime: "2s",
    requiresNetwork: true,
    requiresAuthentication: true,
    supportsRetry: true,
    supportsOfflineQueue: false,
    estimatedLatency: "500ms",
    maturity: 0,
    permissions: [],
    executionPolicy: "confirmation_required",
    capabilityVersion: "1.0.0",
    sdkVersion: "1.0.0",
    minimumKernel: "1.0.0",
    description: `Manages ${cap.name} commitments.`,
    examples: [],
    tags: [cap.category],
    keywords: [cap.name.toLowerCase()],
    edges: []
  }, null, 2);
}

function generateIndex() {
  return `import { Capability, Commitment, ValidationResult, Preview } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, undo, verifier } from './executor';

export const capability: Capability = {
  manifest: manifest as any,
  validate,
  preview: (commitment: Commitment): Preview => ({
    title: commitment.title,
    subtitle: commitment.description || '',
    actions: ['Confirm', 'Cancel']
  }),
  executor: execute,
  verifier,
  undo,
  tests: async () => true
};
`;
}

function generateValidator() {
  return `import { Commitment, ValidationResult } from '../types';

export async function validate(commitment: Commitment): Promise<ValidationResult> {
  const errors: string[] = [];
  if (!commitment.title) {
    errors.push('Title is required.');
  }
  return { 
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
`;
}

function generateExecutor(cap) {
  return `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[\${commitment.capability}] Executing...\`);
  
  await provider.executeAction('execute', { id: commitment.id });
  return { success: true, commitmentId: commitment.id };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  return { verified: true, message: 'Reality verified (mock).' };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  console.log(\`[\${commitmentId}] Undo executed.\`);
}
`;
}

core15.forEach(cap => {
  const folderName = cap.id.split('.')[1];
  const capDir = path.join(CAPABILITIES_DIR, folderName);
  
  if (!fs.existsSync(capDir)) {
    fs.mkdirSync(capDir, { recursive: true });
  }

  fs.writeFileSync(path.join(capDir, 'manifest.json'), generateManifest(cap));
  fs.writeFileSync(path.join(capDir, 'index.ts'), generateIndex());
  fs.writeFileSync(path.join(capDir, 'validator.ts'), generateValidator());
  fs.writeFileSync(path.join(capDir, 'executor.ts'), generateExecutor(cap));
  
  console.log(`Scaffolded: ${cap.id}`);
});
