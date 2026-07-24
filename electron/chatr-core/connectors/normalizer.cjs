'use strict';

/**
 * Normalizer Layer
 * Guarantees every provider produces identical contracts.
 */
class Normalizer {
  
  /**
   * Transforms raw API output into the chatr.discovery_result.v0_9_rc ABI.
   * 
   * @param {string} providerId 
   * @param {string} version 
   * @param {string} health 
   * @param {number} latencyMs 
   * @param {object} rawData 
   * @returns {object} Normalized ABI
   */
  static normalizeDiscoveryResult(providerId, version, health, latencyMs, rawData) {
    // Determine entity type heuristically or based on known provider
    const entityType = ['zomato', 'swiggy'].includes(providerId) ? 'restaurant' : 
                       (providerId === 'makemytrip' ? 'hotel' : 'unknown');

    // Mappings
    const result = {
      abi: 'chatr.discovery_result.v0_9_rc',
      provider: providerId,
      connector_version: version,
      capability: 'DISCOVER',
      entity_type: entityType,
      entity_id: rawData.id || rawData.entityId || `gen_${Date.now()}`,
      title: rawData.name || rawData.title || 'Unknown Entity',
      price: rawData.price || rawData.cost || 0,
      eta: rawData.eta || rawData.deliveryTime || 0,
      rating: rawData.rating || rawData.score || 0,
      confidence: rawData.confidence || 0.85, // Default confidence
      latency_ms: latencyMs,
      cache_status: 'miss', // Upstream cache will rewrite this to 'warm' if hit
      health: health
    };

    // Special fields for Food
    if (rawData.fee !== undefined) result.delivery_fee = rawData.fee;
    if (rawData.offers) result.offers = rawData.offers;
    
    // Availability
    result.availability = rawData.available === false ? 'unavailable' : 'available';

    return result;
  }
}

module.exports = { Normalizer };
