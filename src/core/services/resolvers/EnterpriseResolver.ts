import { Intent } from '../../intent/types';
import { ResolvedContext } from '../../capabilities/types';
import { IContextResolver, resolverRegistry } from '../ResolverRegistry';
import { enterpriseMemory } from '../EnterpriseMemory';

export class EnterpriseResolver implements IContextResolver {
  name = 'EnterpriseResolver';
  order = 40; // Runs after ContactResolver (30)

  async resolve(intent: Intent, currentContext: Partial<ResolvedContext>): Promise<Partial<ResolvedContext>> {
    const contextUpdates: Partial<ResolvedContext> = {};

    // For a real implementation, we would extract entities (like "my manager" or "Rahul") 
    // from the Intent's entities or the raw text and resolve them here.
    // For Genesis, we mock this by checking if the intent contains keywords.

    if (intent.entities?.people) {
      contextUpdates.people = [];
      for (const p of intent.entities.people) {
        const matches = await enterpriseMemory.resolvePerson(p.value);
        if (matches.length > 0) {
          contextUpdates.people.push(matches[0]); // Taking top confidence match
        }
      }
    }

    // Example mock resolution for "my manager" if not explicitly in entities
    const rawText = JSON.stringify(intent).toLowerCase();
    if (rawText.includes('manager')) {
      const matches = await enterpriseMemory.resolvePerson('manager');
      if (matches.length > 0) {
        if (!contextUpdates.people) contextUpdates.people = [];
        contextUpdates.people.push(matches[0]);
      }
    }

    if (rawText.includes('expense') || rawText.includes('leave')) {
      const policyTopic = rawText.includes('expense') ? 'expense' : 'leave';
      const matches = await enterpriseMemory.resolvePolicy(policyTopic);
      if (matches.length > 0) {
        contextUpdates.policies = [matches[0]];
      }
    }

    return contextUpdates;
  }
}

// Auto-register
resolverRegistry.register(new EnterpriseResolver());
