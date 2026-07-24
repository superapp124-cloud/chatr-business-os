/**
 * Enterprise Registry
 * Catalogs EnterpriseResources and models explicit relationships between them.
 */

class EnterpriseRegistry {
    constructor() {
        this.resources = new Map();
        this.relationships = [];
    }

    /**
     * Registers an EnterpriseResource in the catalog.
     */
    register(resource) {
        if (!resource.id || !resource.type || !resource.version) {
            throw new Error("Invalid EnterpriseResource: Missing id, type, or version");
        }
        
        this.resources.set(resource.id, resource);
        console.log(`[EnterpriseRegistry] Registered Resource: ${resource.id} (${resource.type} v${resource.version})`);
    }

    /**
     * Defines a relationship between two resources.
     */
    addRelationship(sourceId, relation, targetId) {
        if (!this.resources.has(sourceId) && !sourceId.startsWith('ext_')) {
             console.warn(`[EnterpriseRegistry] Warning: Source resource ${sourceId} not found in catalog.`);
        }
        
        const rel = { sourceId, relation, targetId, timestamp: new Date().toISOString() };
        this.relationships.push(rel);
        console.log(`[EnterpriseRegistry] Relationship created: ${sourceId} -[${relation}]-> ${targetId}`);
    }

    /**
     * Gets a resource by ID.
     */
    getResource(id) {
        return this.resources.get(id);
    }

    /**
     * Finds all downstream resources related to a given source.
     */
    getDownstream(sourceId, relation = null) {
        return this.relationships.filter(r => 
            r.sourceId === sourceId && (!relation || r.relation === relation)
        );
    }
}

module.exports = new EnterpriseRegistry();
