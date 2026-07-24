/**
 * Package Definition
 * Represents a uniform distributable asset in the Platform Exchange.
 */

const crypto = require('crypto');

class Package {
    constructor({ publisher, namespace, name, version, channel, type, provides = [], requires = [], provenance = {} }) {
        if (!publisher || !namespace || !name || !version || !channel || !type) {
            throw new Error("Missing required package identity or type fields.");
        }

        // Generate deterministic hash for package identity
        const identityString = `${publisher}:${namespace}:${name}:${version}:${channel}`;
        const hash = crypto.createHash('sha256').update(identityString).digest('hex');

        this.identity = {
            publisher,
            namespace,
            name,
            version,
            channel,
            hash
        };
        
        this.type = type;
        this.provides = provides;
        this.requires = requires;
        this.provenance = provenance;
        this.lifecycleState = "Draft";
    }

    /**
     * Unique globally-identifiable string for this package version
     */
    getURN() {
        return `urn:chatr:pkg:${this.identity.publisher}:${this.identity.namespace}:${this.identity.name}:${this.identity.version}:${this.identity.channel}`;
    }

    /**
     * Set explicit supply-chain provenance.
     */
    setProvenance(repo, commit, pipeline) {
        this.provenance = {
            sourceRepository: repo,
            commit,
            buildPipeline: pipeline,
            buildHash: this.identity.hash // Simplified for mock
        };
    }
}

module.exports = Package;
