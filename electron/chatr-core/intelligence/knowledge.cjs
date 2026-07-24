/**
 * Knowledge Engine (Understand Domain)
 * The operational semantic memory of the platform.
 * Indexes relationships between Intent Graphs, Execution Plans, Outcomes, and Recommendations.
 */

class KnowledgeEngine {
    constructor() {
        this.semanticIndex = new Map();
        this.edges = [];
    }

    /**
     * Index a semantic relationship between two operational artifacts.
     */
    indexRelationship(sourceId, relation, targetId, context = {}) {
        this.edges.push({ sourceId, relation, targetId, context, timestamp: new Date().toISOString() });
        console.log(`[KnowledgeEngine] Indexed Semantic Relation: ${sourceId} -[${relation}]-> ${targetId}`);
    }

    /**
     * Store an immutable operational artifact for reasoning.
     */
    storeArtifact(artifact) {
        if (!artifact.id || !artifact.type) throw new Error("Invalid operational artifact");
        this.semanticIndex.set(artifact.id, artifact);
        console.log(`[KnowledgeEngine] Stored ${artifact.type}: ${artifact.id}`);
    }

    /**
     * Query the operational history to understand what happened.
     */
    queryHistory(artifactId) {
        return this.edges.filter(e => e.sourceId === artifactId || e.targetId === artifactId);
    }
}

module.exports = new KnowledgeEngine();
