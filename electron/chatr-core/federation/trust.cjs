/**
 * Trust Service (Trust & Federation Plane)
 * Manages explicit, capability-scoped Trust Relationships between organizations.
 * Separates explicit Trust from observed Reputation.
 */

class TrustService {
    constructor() {
        this.relationships = new Map();
        this.reputationStore = new Map(); // Tracks observed reputation separately
    }

    /**
     * Proposes a new Trust Relationship between two organizations for specific capabilities.
     */
    proposeTrust(sourceOrg, targetOrg, allowedCapabilities) {
        const id = `trust_${Date.now()}`;
        const relationship = {
            id,
            sourceOrg,
            targetOrg,
            allowedCapabilities,
            trustLevel: {
                identityTrust: "Low",
                publisherTrust: "Low",
                packageTrust: "Low",
                operationalTrust: "Low",
                complianceTrust: "Low"
            },
            policies: [],
            lifecycleState: "Proposed"
        };
        
        this.relationships.set(id, relationship);
        console.log(`[TrustService] Proposed Trust Relationship ${id} between ${sourceOrg} and ${targetOrg}`);
        return relationship;
    }

    /**
     * Negotiates and activates the trust relationship.
     */
    activateTrust(id, negotiatedTrustLevels) {
        const relationship = this.relationships.get(id);
        if (!relationship) throw new Error("Trust Relationship not found");

        relationship.trustLevel = { ...relationship.trustLevel, ...negotiatedTrustLevels };
        relationship.lifecycleState = "Active";
        console.log(`[TrustService] Trust Relationship ${id} Negotiated and Active.`);
    }

    /**
     * Get an Active Trust Relationship.
     */
    getActiveTrust(sourceOrg, targetOrg) {
        for (const rel of this.relationships.values()) {
            if (rel.sourceOrg === sourceOrg && rel.targetOrg === targetOrg && rel.lifecycleState === "Active") {
                return rel;
            }
        }
        return null;
    }

    /**
     * Records an operational reputation event (e.g., successful package import).
     * This DOES NOT automatically change the TrustLevel, keeping them separate.
     */
    recordReputationEvent(targetOrg, eventType, success) {
        if (!this.reputationStore.has(targetOrg)) {
            this.reputationStore.set(targetOrg, { successfulImports: 0, failures: 0 });
        }
        const rep = this.reputationStore.get(targetOrg);
        if (success) rep.successfulImports++;
        else rep.failures++;
        
        console.log(`[TrustService] Recorded reputation event for ${targetOrg}. Success: ${success}`);
    }
}

module.exports = new TrustService();
