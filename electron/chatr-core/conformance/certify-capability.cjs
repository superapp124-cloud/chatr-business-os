const fs = require('fs');
const yaml = require('js-yaml');
const { validateEventType } = require('../events/schema.cjs');

/**
 * Capability Certification SDK
 * Validates a capability manifest and implementation against the OS Constitution.
 */

function certifyManifest(manifestPath) {
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`MANIFEST_VIOLATION: File not found at ${manifestPath}`);
    }
    
    const fileContents = fs.readFileSync(manifestPath, 'utf8');
    const doc = yaml.load(fileContents);

    const requiredFields = ['id', 'version', 'intent_types', 'verification'];
    for (const field of requiredFields) {
        if (!doc[field]) {
            throw new Error(`MANIFEST_VIOLATION: Missing required field "${field}"`);
        }
    }

    if (!Array.isArray(doc.intent_types) || doc.intent_types.length === 0) {
        throw new Error('MANIFEST_VIOLATION: intent_types must be a non-empty array');
    }

    if (typeof doc.verification !== 'object' || doc.verification === null) {
        throw new Error('MANIFEST_VIOLATION: verification must be an object');
    }
    const reqVer = ['strategy', 'evidence', 'success', 'failure'];
    for (const vField of reqVer) {
        if (!doc.verification[vField]) {
            throw new Error(`MANIFEST_VIOLATION: Missing required verification field "${vField}"`);
        }
    }
    if (!Array.isArray(doc.verification.evidence)) {
        throw new Error('MANIFEST_VIOLATION: verification.evidence must be an array');
    }

    return doc;
}

function certifyImplementation(modulePath) {
    const impl = require(modulePath);
    
    // Enforce Device Driver contract
    const requiredMethods = ['discover', 'plan', 'execute'];
    for (const method of requiredMethods) {
        if (typeof impl[method] !== 'function') {
            throw new Error(`IMPLEMENTATION_VIOLATION: Missing required method "${method}"`);
        }
    }

    return true;
}

module.exports = {
    certifyManifest,
    certifyImplementation
};
