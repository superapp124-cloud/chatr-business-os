/**
 * Identity Federation Service
 * Maps remote authenticated identity assertions to local authorized Principals.
 * NEVER inherits authorization implicitly.
 */

const crypto = require('crypto');
const IdentityService = require('../enterprise/identity.cjs');

class IdentityFederation {
    constructor() {
        this.assertionMappings = new Map();
    }

    /**
     * Validates a remote IdentityAssertion and maps it to a Local Principal.
     */
    mapAssertionToPrincipal(assertion, targetWorkspace) {
        console.log(`[IdentityFederation] Validating Identity Assertion from ${assertion.issuer} for subject ${assertion.subject}`);
        
        // 1. Verify Signature (Mock)
        if (assertion.signature !== 'valid_crypto_sig') {
            throw new Error("Identity Assertion signature is invalid.");
        }

        // 2. Map to local principal. 
        // Instead of bypassing auth, we issue a specific 'ExternalSystem' or 'Federated' Principal
        // which the local AuthorizationService will enforce policies against.
        
        const mappedId = `ext_${crypto.createHash('md5').update(assertion.subject).digest('hex')}`;
        
        // Check if we already mapped this
        let principal = IdentityService.getPrincipal(mappedId);
        
        if (!principal) {
            // Create a local principal representing this external subject
            principal = IdentityService.createPrincipal('ExternalSystem', mappedId);
            this.assertionMappings.set(mappedId, assertion);
            console.log(`[IdentityFederation] Mapped remote subject ${assertion.subject} to local Principal ${principal.id}`);
        } else {
            console.log(`[IdentityFederation] Resolved existing mapping for local Principal ${principal.id}`);
        }

        return principal;
    }
}

module.exports = new IdentityFederation();
