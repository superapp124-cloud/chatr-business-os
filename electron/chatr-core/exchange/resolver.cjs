/**
 * Dependency Resolver & Compatibility Engine
 * Resolves packages from the Resolution Catalog based on explicit 'requires' statements.
 * Checks static ABI compatibility.
 */

const CatalogService = require('./catalog.cjs');

class DependencyResolver {
    /**
     * Resolves dependencies and builds an Installation Plan for a given set of packages.
     * Takes in a PlatformManifest-style request.
     */
    resolve(requestedUrns, platformInfo) {
        console.log(`[DependencyResolver] Resolving dependencies for: ${requestedUrns.join(', ')}`);
        const resolvedPackages = new Map();
        const stack = [...requestedUrns];

        while (stack.length > 0) {
            const urn = stack.pop();
            if (resolvedPackages.has(urn)) continue;

            const pkgData = CatalogService.getResolutionData(urn);
            if (!pkgData) {
                throw new Error(`Resolution Failed: Package not found in Resolution Catalog: ${urn}`);
            }

            // Check Platform Compatibility
            this._checkCompatibility(pkgData, platformInfo);

            resolvedPackages.set(urn, pkgData);

            // Mock resolving transitive dependencies
            if (pkgData.requires) {
                for (const req of pkgData.requires) {
                    // In a real implementation, this would search the catalog for a package providing `req.capability`
                    // For the mock, we assume the specific URN is provided or we skip
                    if (req.urn && !resolvedPackages.has(req.urn)) {
                        stack.push(req.urn);
                    }
                }
            }
        }

        console.log(`[DependencyResolver] Successfully resolved ${resolvedPackages.size} packages.`);
        return Array.from(resolvedPackages.values());
    }

    _checkCompatibility(pkgData, platformInfo) {
        // Mock static compatibility check against Platform Manifest constraints
        if (platformInfo.kernel && pkgData.requires && pkgData.requires.some(r => r.kernel && r.kernel > platformInfo.kernel)) {
            throw new Error(`Static Compatibility Failed: Package ${pkgData.urn} requires Kernel > ${platformInfo.kernel}`);
        }
    }
}

module.exports = new DependencyResolver();
