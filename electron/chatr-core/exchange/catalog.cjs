/**
 * Catalog Service
 * Maintains the separation between Discovery (human-facing) and Resolution (machine-facing) indices.
 */

class CatalogService {
    constructor() {
        // Optimizes for users: search, categories, tags, ratings.
        this.discoveryCatalog = new Map();
        
        // Optimizes for machines: dependencies, compatibility, signatures, constraints.
        this.resolutionCatalog = new Map();
    }

    /**
     * Registers a published package into both catalogs.
     */
    registerPackage(pkg) {
        if (pkg.lifecycleState !== 'Published') {
            throw new Error(`Only Published packages can enter the Exchange Catalog. Package is ${pkg.lifecycleState}`);
        }

        const urn = pkg.getURN();
        
        // Populate Discovery Index
        this.discoveryCatalog.set(urn, {
            urn,
            publisher: pkg.identity.publisher,
            name: pkg.identity.name,
            version: pkg.identity.version,
            channel: pkg.identity.channel,
            type: pkg.type,
            // Mocking metadata that would exist for UI
            description: `A ${pkg.type} package by ${pkg.identity.publisher}`,
            categories: ["General"],
            rating: 5.0
        });

        // Populate Resolution Index
        this.resolutionCatalog.set(urn, {
            urn,
            hash: pkg.identity.hash,
            type: pkg.type,
            provides: pkg.provides,
            requires: pkg.requires,
            provenance: pkg.provenance
        });

        console.log(`[CatalogService] Package ${urn} indexed in Discovery and Resolution catalogs.`);
    }

    searchDiscovery(query) {
        // Mock simple search
        const results = [];
        for (const entry of this.discoveryCatalog.values()) {
            if (entry.name.includes(query) || entry.publisher.includes(query)) {
                results.push(entry);
            }
        }
        return results;
    }

    getResolutionData(urn) {
        return this.resolutionCatalog.get(urn);
    }
}

module.exports = new CatalogService();
