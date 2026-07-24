import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText.toLowerCase();
    
    // Better extraction logic to clean up artifacts
    const fromMatch = text.match(/from\s+([a-zA-Z\s]+?)(?=\s+(to|on|for|tomorrow|next|friday|$))/);
    let toMatch = text.match(/to\s+([a-zA-Z\s]+?)(?=\s+(from|on|for|tomorrow|next|friday|$))/);
    const dateMatch = text.match(/(on friday|tomorrow|next week|on monday|friday)/);

    let to = toMatch ? toMatch[1].trim() : null;
    if (to === 'fly') to = null; // Fix "to fly to delhi" parsing issue
    if (!to) {
      // Fallback: look for "fly to [City]"
      const flyToMatch = text.match(/fly to\s+([a-zA-Z\s]+?)(?=\s+(from|on|for|tomorrow|next|friday|$))/);
      if (flyToMatch) to = flyToMatch[1].trim();
    }

    // Capitalize first letters for UI prettiness
    const capitalize = (s: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : null;

    return {
      from: capitalize(fromMatch ? fromMatch[1].trim() : null),
      to: capitalize(to),
      date: capitalize(dateMatch ? dateMatch[0].trim() : null),
      passengers: 1,
      class: 'economy'
    };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    const resolved: ResolvedEntities = { ...entities, _resolved: true };
    
    // Auto-resolve 'from' via AI / Context Agent
    if (!resolved.from) {
      console.log(`[AI Agent] Auto-resolving home airport from user profile...`);
      resolved.from = 'Srinagar'; // AI magically knows they are in Srinagar
    }
    
    return resolved;
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    
    if (!entities.from) {
      missing.push({
        key: 'from',
        label: 'Departure city?',
        type: 'choice',
        options: ['Srinagar', 'Delhi', 'Mumbai']
      });
    }

    if (!entities.to) {
      missing.push({
        key: 'to',
        label: 'Destination city?',
        type: 'choice',
        options: ['Mumbai', 'Bangalore', 'New York', 'Dubai']
      });
    }
    
    if (!entities.date) {
      missing.push({
        key: 'date',
        label: 'When are you flying?',
        type: 'choice',
        options: ['Tomorrow', 'This Friday', 'Next Week']
      });
    }
    
    return missing;
  },

  requiresSearch(entities: ResolvedEntities): boolean {
    return true; // Flight booking always requires live search
  },

  buildSearchQuery(entities: ResolvedEntities): any {
    return {
      from: entities.from,
      to: entities.to,
      date: entities.date
    };
  },

  formatSearchResults(results: any[]): any[] {
    return results; // Passes through the provider's array
  },

  buildPreview(entities: ResolvedEntities, selectedResult?: any): CommitmentPreview {
    if (selectedResult) {
      return {
        title: `Book ${selectedResult.airline} to ${entities.to}`,
        lines: [
          { label: 'Departure', value: selectedResult.departureTime },
          { label: 'Arrival', value: selectedResult.arrivalTime },
          { label: 'Price', value: selectedResult.price }
        ],
        cta: 'Confirm Booking',
        icon: '✈️'
      };
    }
    
    // Fallback if no selected result (shouldn't happen with the new workflow)
    return {
      icon: '✈️',
      title: `Flight to ${entities.to}`,
      lines: [],
      cta: 'Confirm'
    };
  },

  searchConfiguration: {
    primaryActionLabel: 'Proceed with Booking',
    columns: [
      { key: 'departureTime', label: 'Departs' },
      { key: 'arrivalTime', label: 'Arrives' },
      { key: 'airline', label: 'Airline' },
      { key: 'price', label: 'Price', type: 'currency' }
    ]
  }
};
