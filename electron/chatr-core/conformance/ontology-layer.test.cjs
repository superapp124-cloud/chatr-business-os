const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadSchema(filename) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../schema/ontology', filename), 'utf8'));
}

async function runOntologyConformance() {
    console.log("=== Running Architecture Conformance Suite: Ontology Layer ===");

    const realitySchema = loadSchema('reality.schema.json');
    const businessSchema = loadSchema('business.schema.json');
    const platformSchema = loadSchema('platform.schema.json');
    const traitsSchema = loadSchema('traits.schema.json');
    const lifecyclesSchema = loadSchema('lifecycles.schema.json');

    // Rule 1: Every Business entity derives from Reality concepts (Law 2: Reality First)
    for (const [entityName, def] of Object.entries(businessSchema.definitions)) {
        if (def.extends) {
            const parents = def.extends.split(' | ').map(p => p.trim());
            for (const parent of parents) {
                if (parent.startsWith('reality.')) {
                    const realityEntity = parent.split('.')[1];
                    assert.ok(realitySchema.definitions[realityEntity], `Business entity ${entityName} extends unknown reality entity ${realityEntity}`);
                } else if (parent.startsWith('Business.')) {
                    const businessEntity = parent.split('.')[1];
                    assert.ok(businessSchema.definitions[businessEntity], `Business entity ${entityName} extends unknown business entity ${businessEntity}`);
                } else {
                    assert.fail(`Business entity ${entityName} has invalid extends declaration: ${parent}`);
                }
            }
        } else if (entityName !== 'Task') { // Exceptions
            assert.fail(`Business entity ${entityName} must extend a Reality or Business entity.`);
        }
    }
    console.log("✅ Conformance Pass: All Business entities correctly derive from the Reality Layer (Law 2).");

    // Rule 2: Every entity must use library lifecycle profiles
    const validLifecycles = new Set(Object.keys(lifecyclesSchema.profiles));
    const allSchemas = [realitySchema, businessSchema, platformSchema];
    
    for (const schema of allSchemas) {
        for (const [entityName, def] of Object.entries(schema.definitions)) {
            if (def.lifecycle) {
                assert.ok(validLifecycles.has(def.lifecycle.replace(' ', '')), `Entity ${entityName} uses undefined lifecycle: ${def.lifecycle}`);
            }
        }
    }
    console.log("✅ Conformance Pass: All entities utilize the reusable Canonical Lifecycle Library.");

    // Rule 3: Traits must come from the defined Trait Families
    const validTraits = new Set();
    for (const family of Object.values(traitsSchema.traitFamilies)) {
        for (const trait of Object.keys(family.traits)) {
            validTraits.add(trait);
        }
    }

    for (const schema of allSchemas) {
        for (const [entityName, def] of Object.entries(schema.definitions)) {
            if (def.traits) {
                for (const trait of def.traits) {
                    assert.ok(validTraits.has(trait), `Entity ${entityName} uses undefined trait: ${trait}`);
                }
            }
        }
    }
    console.log("✅ Conformance Pass: All entities correctly compose behavior from the Canonical Trait Library.");

    // Rule 4: No Duplicate Meanings (Law 1)
    const entityNames = new Set();
    for (const schema of allSchemas) {
        for (const entityName of Object.keys(schema.definitions)) {
            assert.ok(!entityNames.has(entityName), `Violation of Law 1: Duplicate canonical definition found for ${entityName}`);
            entityNames.add(entityName);
        }
    }
    console.log("✅ Conformance Pass: The Ontology is strictly additive. No duplicate canonical definitions exist (Law 1).");
    
    console.log("All Ontology Layer Conformance Tests Passed.");
}

runOntologyConformance().catch(console.error);
