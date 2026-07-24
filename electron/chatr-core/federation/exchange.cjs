/**
 * Exchange Federation
 * Safely imports/exports assets across organizational boundaries.
 * Enforces End-to-End Lineage Preservation (identities and signatures are NEVER rewritten).
 */

const crypto = require('crypto');

class ExchangeFederation {
    constructor() {
        this.federatedPackages = new Map();
    }

    /**
     * Imports a package from a remote exchange.
     */
    importPackage(remotePackage, sourceOrg) {
        console.log(`[ExchangeFederation] Importing package ${remotePackage.getURN()} from ${sourceOrg}`);

        // 1. Lineage check: Ensure cryptographic identity is intact.
        const identityString = `${remotePackage.identity.publisher}:${remotePackage.identity.namespace}:${remotePackage.identity.name}:${remotePackage.identity.version}:${remotePackage.identity.channel}`;
        const computedHash = crypto.createHash('sha256').update(identityString).digest('hex');

        if (computedHash !== remotePackage.identity.hash) {
            throw new Error(`Federation Import Rejected: Cryptographic identity mismatch. The package identity was tampered with.`);
        }

        // 2. Wrap package with import metadata, DO NOT mutate the original package identity.
        const federatedWrapper = {
            importId: `fed_import_${Date.now()}`,
            sourceOrg,
            importedAt: new Date().toISOString(),
            originalPackage: remotePackage // Complete preservation of original provenance and signature
        };

        this.federatedPackages.set(remotePackage.getURN(), federatedWrapper);
        console.log(`[ExchangeFederation] Import Successful. Lineage preserved for ${remotePackage.getURN()}`);

        return federatedWrapper;
    }
}

module.exports = new ExchangeFederation();
