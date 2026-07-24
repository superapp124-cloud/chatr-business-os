/**
 * Publishing Pipeline
 * Ensures publishing follows strict governance through the Supply Chain Lifecycle.
 * Draft -> Validated -> Certified -> Signed -> Published -> Revoked
 */

const CatalogService = require('./catalog.cjs');

class PublishingPipeline {
    /**
     * Pushes a package through the supply chain.
     */
    async publish(pkg, governanceDecision) {
        console.log(`[PublishingPipeline] Starting publishing pipeline for ${pkg.getURN()}`);

        // 1. Validate
        this._transition(pkg, "Draft", "Validated");
        
        // 2. Certify
        this._transition(pkg, "Validated", "Certified");

        // 3. Security Scan (Simulated) & Sign
        // In reality, this derives the composite Trust Score
        this._transition(pkg, "Certified", "Signed");

        // 4. Governance Gate
        if (governanceDecision !== 'APPROVED') {
            throw new Error("Publishing blocked: Governance approval required.");
        }

        // 5. Publish
        this._transition(pkg, "Signed", "Published");

        // 6. Register in Catalog
        CatalogService.registerPackage(pkg);
        
        return pkg;
    }

    /**
     * Revokes a package (e.g. security incident). 
     * Distinct from deprecation.
     */
    revoke(pkg) {
        if (pkg.lifecycleState !== 'Published') {
            throw new Error(`Cannot revoke package in state: ${pkg.lifecycleState}`);
        }
        this._transition(pkg, "Published", "Revoked");
        console.warn(`[PublishingPipeline] 🚨 Package ${pkg.getURN()} has been REVOKED.`);
    }

    _transition(pkg, fromState, toState) {
        if (pkg.lifecycleState !== fromState) {
            throw new Error(`Invalid lifecycle transition. Expected ${fromState}, got ${pkg.lifecycleState}`);
        }
        pkg.lifecycleState = toState;
        console.log(`[PublishingPipeline] Transitioned to ${toState}`);
    }
}

module.exports = new PublishingPipeline();
