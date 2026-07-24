import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';
import { searchRuntime } from '../../runtime/SearchRuntime';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText.toLowerCase();
    
    // Very basic extraction for demonstration
    const cityMatch = text.match(/(in|at|near)\s+([a-zA-Z\s]+?)(?=\s+(for|tomorrow|next|friday|$))/);
    const nightsMatch = text.match(/(\d+)\s+nights?/);

    return {
      city: cityMatch ? cityMatch[2].trim() : null,
      nights: nightsMatch ? parseInt(nightsMatch[1]) : 1,
      guests: 2
    };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    if (entities.city && !entities.searchResults) {
      const results = await searchRuntime.runSearch({
        intent: 'hotel',
        filters: { location: entities.city, checkIn: entities.checkIn || new Date().toISOString(), checkOut: entities.checkOut }
      });
      return { ...entities, searchResults: results, _resolved: true };
    }
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    
    if (!entities.city) {
      missing.push({
        key: 'city',
        label: 'Which city?',
        type: 'choice',
        options: ['Mumbai', 'Delhi', 'Goa', 'Bangalore']
      });
    }
    
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    const hotel = entities.searchResults?.[0] || { name: 'Taj Mahal Palace (Estimated)', pricePerNight: '₹12,500 (Estimated)' };

    return {
      icon: '🏨',
      title: `Hotel in ${entities.city}`,
      lines: [
        { label: 'Stay', value: `${entities.nights} Night(s)` },
        { label: 'Guests', value: `${entities.guests} Adults` },
        { label: 'Hotel', value: hotel.name || hotel.title || 'Unknown Hotel' },
        { label: 'Price', value: hotel.pricePerNight || hotel.price || 'Unknown Price' }
      ],
      cta: 'Book Hotel'
    };
  }
};
