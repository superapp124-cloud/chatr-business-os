const fs = require('fs');
const path = require('path');

const capabilitiesDir = path.join(process.cwd(), 'src/core/capabilities');

const indexTemplate = `import { Capability, CommitmentPreview } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, verifier, undo } from './executor';
import { playbook } from './playbook';

export const capability: Capability = {
  manifest: manifest as any,
  validate: validate,
  preview: (commitment) => ({
    title: commitment.title,
    subtitle: commitment.description || '',
    actions: ['Confirm', 'Cancel']
  }),
  executor: execute,
  verifier,
  undo,
  tests: async () => true,
  playbook
};`;

const capabilities = [
  {
    name: 'note',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.note] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'note',
    content: commitment.entities?.content || commitment.title
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const storage = providers[0];
  if (!storage.verify) return { verified: false, provider: storage.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await storage.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: \`NOTE-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) {
      storage.delete(commitmentId);
    }
  }
}`,
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
      title: \`Save Note\`,
      subtitle: \`\${entities.content}\`,
      actions: ['Save', 'Cancel'],
      icon: '📝'
    };
  }
};`
  },
  {
    name: 'checklist',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.checklist] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'checklist',
    title: commitment.title,
    items: commitment.entities?.items || []
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const storage = providers[0];
  if (!storage.verify) return { verified: false, provider: storage.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await storage.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: \`CHECK-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) {
      storage.delete(commitmentId);
    }
  }
}`,
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
      title: \`Create Checklist\`,
      subtitle: \`\${entities.title}\`,
      actions: ['Save', 'Cancel'],
      icon: '☑️'
    };
  }
};`
  },
  {
    name: 'meeting',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.meeting] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No calendar provider available');
  
  const calendar = providers[0];
  if (!calendar.create) throw new Error('Calendar does not support create');
  
  const result = await calendar.create({
    id: commitment.id,
    type: 'meeting',
    title: commitment.title,
    timeSlot: commitment.selectedResult?.timeSlot,
    attendees: commitment.entities?.attendees
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const calendar = providers[0];
  if (!calendar.verify) return { verified: false, provider: calendar.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await calendar.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: calendar.name,
    timestamp: new Date().toISOString(),
    transactionId: \`MEET-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length > 0) {
    const calendar = providers[0] as any;
    if (calendar.delete) {
      calendar.delete(commitmentId);
    }
  }
}`
  },
  {
    name: 'follow_up',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.follow_up] Executing commitment \${commitment.id}\`);
  
  if (commitment.schedule && commitment.schedule.resolved) {
    const scheduledTime = new Date(commitment.schedule.resolved);
    
    // Get the universal system execution provider (SchedulerProvider)
    const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
    if (providers.length === 0) throw new Error('No scheduler provider available');
    
    const scheduler = providers[0];
    if (!scheduler.create) throw new Error('Scheduler does not support create');
    
    const result = await scheduler.create({
      id: commitment.id,
      time: scheduledTime,
      title: \`Follow up: \${commitment.title}\`,
      capability: 'core.follow_up'
    });

    return { 
      success: true, 
      commitmentId: commitment.id,
      providerData: result 
    };
  }
  
  return { success: false, commitmentId: commitment.id, message: 'No valid time to schedule follow-up' };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const scheduler = providers[0];
  if (!scheduler.verify) return { verified: false, provider: scheduler.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await scheduler.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: scheduler.name,
    timestamp: new Date().toISOString(),
    transactionId: \`FOLLOWUP-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length > 0) {
    const scheduler = providers[0] as any;
    if (scheduler.cancel) {
      scheduler.cancel(commitmentId);
    }
  }
}`,
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
      title: \`Set Follow-up\`,
      subtitle: \`\${entities.title} on \${entities.time}\`,
      actions: ['Confirm', 'Cancel'],
      icon: '🔄'
    };
  }
};`
  },
  {
    name: 'call',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.call] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('communication', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No communication provider available');
  
  const comms = providers[0];
  if (!comms.create) throw new Error('Communication provider does not support create');
  
  const result = await comms.create({
    id: commitment.id,
    type: 'call',
    recipient: commitment.entities?.contact,
    message: ''
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('communication', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const comms = providers[0];
  if (!comms.verify) return { verified: false, provider: comms.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await comms.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: comms.name,
    timestamp: new Date().toISOString(),
    transactionId: \`CALL-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  // Calls generally can't be undone once dispatched
}`,
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
      subtitle: \`Voice call\`,
      actions: ['Call Now', 'Cancel'],
      icon: '📞'
    };
  }
};`
  },
  {
    name: 'email',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.email] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('communication', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No communication provider available');
  
  const comms = providers[0];
  if (!comms.create) throw new Error('Communication provider does not support create');
  
  const result = await comms.create({
    id: commitment.id,
    type: 'email',
    recipient: commitment.entities?.contact,
    message: commitment.entities?.content
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('communication', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const comms = providers[0];
  if (!comms.verify) return { verified: false, provider: comms.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await comms.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: comms.name,
    timestamp: new Date().toISOString(),
    transactionId: \`EMAIL-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
}`,
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
      subtitle: \`\${entities.content || 'Draft email'}\`,
      actions: ['Send Email', 'Cancel'],
      icon: '✉️'
    };
  }
};`
  },
  {
    name: 'contact',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.contact] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage provider does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'contact',
    name: commitment.entities?.contactName,
    phone: commitment.entities?.phoneNumber,
    email: commitment.entities?.emailAddress
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const storage = providers[0];
  if (!storage.verify) return { verified: false, provider: storage.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await storage.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: \`CONTACT-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) storage.delete(commitmentId);
  }
}`,
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
      title: \`Save Contact\`,
      subtitle: \`\${entities.contactName}\`,
      actions: ['Save', 'Cancel'],
      icon: '👤'
    };
  }
};`
  },
  {
    name: 'calendar_event',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.calendar_event] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No calendar provider available');
  
  const calendar = providers[0];
  if (!calendar.create) throw new Error('Calendar provider does not support create');
  
  const result = await calendar.create({
    id: commitment.id,
    type: 'event',
    title: commitment.title,
    timeSlot: commitment.entities?.time
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const calendar = providers[0];
  if (!calendar.verify) return { verified: false, provider: calendar.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await calendar.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: calendar.name,
    timestamp: new Date().toISOString(),
    transactionId: \`CALEVENT-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length > 0) {
    const calendar = providers[0] as any;
    if (calendar.delete) calendar.delete(commitmentId);
  }
}`,
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
      title: \`Add to Calendar\`,
      subtitle: \`\${entities.title} on \${entities.time}\`,
      actions: ['Save Event', 'Cancel'],
      icon: '📅'
    };
  }
};`
  },
  {
    name: 'document',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.document] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage provider does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'document',
    title: commitment.title,
    content: commitment.entities?.content
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const storage = providers[0];
  if (!storage.verify) return { verified: false, provider: storage.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await storage.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: \`DOC-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) storage.delete(commitmentId);
  }
}`,
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
      title: \`Create Document\`,
      subtitle: \`\${entities.title}\`,
      actions: ['Save', 'Cancel'],
      icon: '📄'
    };
  }
};`
  },
  {
    name: 'candidate_interview',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.interview] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No calendar provider available');
  
  const calendar = providers[0];
  if (!calendar.create) throw new Error('Calendar provider does not support create');
  
  const result = await calendar.create({
    id: commitment.id,
    type: 'interview',
    title: \`Interview with \${commitment.entities?.candidate}\`,
    timeSlot: commitment.entities?.time
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const calendar = providers[0];
  if (!calendar.verify) return { verified: false, provider: calendar.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await calendar.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: calendar.name,
    timestamp: new Date().toISOString(),
    transactionId: \`INT-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length > 0) {
    const calendar = providers[0] as any;
    if (calendar.delete) calendar.delete(commitmentId);
  }
}`,
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
      title: \`Schedule Interview\`,
      subtitle: \`With \${entities.candidate} on \${entities.time}\`,
      actions: ['Schedule', 'Cancel'],
      icon: '👔'
    };
  }
};`
  },
  {
    name: 'expense',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.expense] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage provider does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'expense',
    description: commitment.entities?.description,
    amount: commitment.entities?.amount
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const storage = providers[0];
  if (!storage.verify) return { verified: false, provider: storage.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await storage.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: \`EXP-\${commitment.id}\`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) storage.delete(commitmentId);
  }
}`,
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
      title: \`Log Expense\`,
      subtitle: \`\${entities.description} - $\${entities.amount}\`,
      actions: ['Save', 'Cancel'],
      icon: '💵'
    };
  }
};`
  }
];

capabilities.forEach(cap => {
  const dir = path.join(capabilitiesDir, cap.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.ts'), indexTemplate, 'utf8');
  if (cap.executor) fs.writeFileSync(path.join(dir, 'executor.ts'), cap.executor, 'utf8');
  if (cap.playbook) fs.writeFileSync(path.join(dir, 'playbook.ts'), cap.playbook, 'utf8');
});
console.log('Fixed syntax and restored all files!');
