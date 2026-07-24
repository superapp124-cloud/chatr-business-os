const fs = require('fs');
const path = require('path');

const capabilitiesDir = path.join(process.cwd(), 'src/core/capabilities');

const capabilities = [
  {
    name: 'task',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.task] Executing commitment \${commitment.id}\`);
  
  const providers = await providerRegistry.getHealthyProviders('system', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'task',
    title: commitment.title,
    entities: commitment.entities
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
    transactionId: \`TASK-\${commitment.id}\`,
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
      title: \`Create Task\`,
      subtitle: \`\${entities.title}\`,
      actions: ['Save', 'Cancel'],
      icon: '✅'
    };
  }
};`
  },
  {
    name: 'reminder',
    executor: `import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(\`[core.reminder] Executing commitment \${commitment.id}\`);
  
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
      title: commitment.title,
      capability: 'core.reminder'
    });

    return { 
      success: true, 
      commitmentId: commitment.id,
      providerData: result 
    };
  }
  
  return { success: false, commitmentId: commitment.id, message: 'No valid time to schedule' };
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
    transactionId: \`TIMER-\${commitment.id}\`,
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
      title: \`Reminder\`,
      subtitle: \`\${entities.title} at \${entities.time}\`,
      actions: ['Save', 'Cancel'],
      icon: '🔔'
    };
  }
};`
  }
];

capabilities.forEach(cap => {
  const dir = path.join(capabilitiesDir, cap.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (cap.executor) fs.writeFileSync(path.join(dir, 'executor.ts'), cap.executor, 'utf8');
  if (cap.playbook) fs.writeFileSync(path.join(dir, 'playbook.ts'), cap.playbook, 'utf8');
});
console.log('Fixed task and reminder too!');
