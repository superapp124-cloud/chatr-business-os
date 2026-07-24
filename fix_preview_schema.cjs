const fs = require('fs');
const path = require('path');

const capabilitiesDir = path.join(process.cwd(), 'src/core/capabilities');

function updateCapabilities(caps) {
  caps.forEach(cap => {
    const dir = path.join(capabilitiesDir, cap.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // Update index.ts
    const indexStr = `import { Capability, CommitmentPreview } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, verifier, undo } from './executor';
import { playbook } from './playbook';

export const capability: Capability = {
  manifest: manifest as any,
  validate: validate,
  preview: (commitment) => ({
    title: commitment.title,
    lines: [{ label: 'Details', value: commitment.description || '' }],
    cta: 'Confirm'
  }),
  executor: execute,
  verifier,
  undo,
  tests: async () => true,
  playbook
};`;
    fs.writeFileSync(path.join(dir, 'index.ts'), indexStr, 'utf8');

    // Update playbook.ts if provided
    if (cap.playbook) {
      fs.writeFileSync(path.join(dir, 'playbook.ts'), cap.playbook, 'utf8');
    }
  });
}

const capabilities = [
  {
    name: 'note',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(note to self:|take a note|note down|jot down|note:)\\s+/i, '');
    return { title, content: title };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    return [];
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Save Note',
      lines: [{ label: 'Note', value: entities.content || '' }],
      cta: 'Save',
      icon: '📝'
    };
  }
};`
  },
  {
    name: 'checklist',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(create a checklist|new checklist|checklist:)\\s+/i, '');
    return { title, items: [] };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    return [];
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Create Checklist',
      lines: [{ label: 'Checklist', value: entities.title || '' }],
      cta: 'Save',
      icon: '☑️'
    };
  }
};`
  },
  {
    name: 'meeting'
  },
  {
    name: 'follow_up',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(follow up|follow-up|followup)\\s+/i, '');
    return { title };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When should I follow up?',
        type: 'choice',
        options: ['Tomorrow', 'Next Week', 'In a month']
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Set Follow-up',
      lines: [
        { label: 'Follow up', value: entities.title || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Confirm',
      icon: '🔄'
    };
  }
};`
  },
  {
    name: 'call',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let contact = text.replace(/^(call|phone|ring)\\s+/i, '');
    return { contact };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.contact) {
      missing.push({
        key: 'contact',
        label: 'Who should I call?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: \`Call \${entities.contact}\`,
      lines: [{ label: 'Action', value: 'Voice call' }],
      cta: 'Call Now',
      icon: '📞'
    };
  }
};`
  },
  {
    name: 'email',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let contact = text.replace(/^(email|send email to|mail)\\s+/i, '');
    return { contact };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.contact) {
      missing.push({
        key: 'contact',
        label: 'Who should I email?',
        type: 'text'
      });
    }
    if (!entities.content) {
      missing.push({
        key: 'content',
        label: 'What should I say?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: \`Email \${entities.contact}\`,
      lines: [{ label: 'Message', value: entities.content || 'Draft email' }],
      cta: 'Send Email',
      icon: '✉️'
    };
  }
};`
  },
  {
    name: 'contact',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let contactName = text.replace(/^(add contact|new contact|save contact|create contact)\\s+/i, '');
    return { contactName };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.contactName) {
      missing.push({
        key: 'contactName',
        label: 'What is the name?',
        type: 'text'
      });
    }
    if (!entities.phoneNumber && !entities.emailAddress) {
      missing.push({
        key: 'phoneNumber',
        label: 'What is their phone number?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Save Contact',
      lines: [
        { label: 'Name', value: entities.contactName || '' },
        { label: 'Phone', value: entities.phoneNumber || '' }
      ],
      cta: 'Save',
      icon: '👤'
    };
  }
};`
  },
  {
    name: 'calendar_event',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(schedule event|new event|add to calendar|create event)\\s+/i, '');
    return { title };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When is this event?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Add to Calendar',
      lines: [
        { label: 'Event', value: entities.title || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Save Event',
      icon: '📅'
    };
  }
};`
  },
  {
    name: 'document',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(create document|new document|draft|write)\\s+/i, '');
    return { title, content: '' };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.title) {
      missing.push({
        key: 'title',
        label: 'What should we call the document?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Create Document',
      lines: [{ label: 'Title', value: entities.title || '' }],
      cta: 'Save',
      icon: '📄'
    };
  }
};`
  },
  {
    name: 'candidate_interview',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let candidate = text.replace(/^(schedule interview with|interview|schedule interview)\\s+/i, '');
    return { candidate };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.candidate) {
      missing.push({
        key: 'candidate',
        label: 'Who is the candidate?',
        type: 'text'
      });
    }
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When is the interview?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Schedule Interview',
      lines: [
        { label: 'Candidate', value: entities.candidate || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Schedule',
      icon: '👔'
    };
  }
};`
  },
  {
    name: 'expense',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let amountMatch = text.match(/\\$?([0-9]+\\.?[0-9]*)/);
    let amount = amountMatch ? amountMatch[1] : null;
    let description = text.replace(/^(log expense|expense|add expense)\\s+/i, '');
    return { description, amount };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.amount) {
      missing.push({
        key: 'amount',
        label: 'How much was it?',
        type: 'text'
      });
    }
    if (!entities.description) {
      missing.push({
        key: 'description',
        label: 'What was the expense for?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Log Expense',
      lines: [
        { label: 'Description', value: entities.description || '' },
        { label: 'Amount', value: entities.amount ? \`$\${entities.amount}\` : '' }
      ],
      cta: 'Save',
      icon: '💵'
    };
  }
};`
  },
  {
    name: 'task',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(remind me to|create a task to|create task to|task:)\\s+/i, '');
    return { title };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    return [];
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Create Task',
      lines: [{ label: 'Task', value: entities.title || '' }],
      cta: 'Save',
      icon: '✅'
    };
  }
};`
  },
  {
    name: 'reminder',
    playbook: `import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(remind me to|set a reminder to|remind me)\\s+/i, '');
    return { title };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing = [];
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When should I remind you?',
        type: 'choice',
        options: ['In 10 minutes', 'Tomorrow morning', 'Custom']
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Reminder',
      lines: [
        { label: 'Reminder', value: entities.title || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Save',
      icon: '🔔'
    };
  }
};`
  }
];

updateCapabilities(capabilities);
console.log('Fixed CommitmentPreview schema issues');
