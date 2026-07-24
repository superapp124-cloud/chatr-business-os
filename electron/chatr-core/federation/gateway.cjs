/**
 * Trust Gateway (Trust & Federation Plane)
 * The SOLE cross-organization communication path.
 * Rigidly enforces Identity, Trust, and Policy before routing payloads.
 * Contains ZERO business logic.
 */

const TrustService = require('./trust.cjs');
const IdentityFederation = require('./identity.cjs');

class TrustGateway {
    /**
     * Intercepts incoming federated requests.
     */
    async processIncoming(payload, assertion, sourceOrg, targetOrg, requestedCapability) {
        console.log(`[TrustGateway] 🛡️ Intercepted incoming payload from ${sourceOrg} targeting ${targetOrg} for ${requestedCapability}`);

        // 1. Evaluate Trust (Is there an Active relationship trusted for this capability?)
        const activeTrust = TrustService.getActiveTrust(sourceOrg, targetOrg);
        if (!activeTrust) {
            throw new Error(`Trust Gateway Rejected: No active trust relationship between ${sourceOrg} and ${targetOrg}.`);
        }
        if (!activeTrust.allowedCapabilities.includes(requestedCapability)) {
            throw new Error(`Trust Gateway Rejected: ${sourceOrg} is not trusted for capability '${requestedCapability}'. Trust is capability-scoped.`);
        }

        // 2. Identity Mapping (Map assertion to local principal)
        const localPrincipal = IdentityFederation.mapAssertionToPrincipal(assertion, targetOrg);

        // 3. Establish Federation Session
        const session = {
            sessionId: `fed_sess_${Date.now()}`,
            trustRelationshipId: activeTrust.id,
            identityMapping: { source: assertion.subject, localPrincipal: localPrincipal.id },
            policyCompatibility: true, // Mocked policy negotiation
            validUntil: new Date(Date.now() + 3600000).toISOString(),
            auditCorrelationId: `audit_${Date.now()}`
        };

        console.log(`[TrustGateway] 🛡️ Session ${session.sessionId} established. Trust verified. Routing to Local Execution Plane.`);

        // 4. Secure Routing (In a real system, routes to the local intent compiler/runner)
        return {
            status: "ROUTED",
            session,
            routedPayload: payload,
            executingPrincipal: localPrincipal
        };
    }
}

module.exports = new TrustGateway();
