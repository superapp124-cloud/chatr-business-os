'use strict';

/**
 * Travel Intent Model
 */
module.exports = {
  id: 'intent.travel.flight.book',
  domain: 'travel',
  description: 'Parses requests to book a flight',
  
  async parse(rawInput) {
    const input = rawInput.toLowerCase();
    if (input.includes('book') || input.includes('flight')) {
      // Basic heuristic parser for MVP
      const destinationMatch = input.match(/to (\w+)/);
      const destination = destinationMatch ? destinationMatch[1] : 'unknown';
      
      return {
        intent_type: 'travel.flight.book',
        constraints: {
          destination: destination
        },
        confidence: 0.85
      };
    }
    return null; // Not a travel intent
  }
};
