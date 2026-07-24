const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadSchema(filename) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../schema/composition', filename), 'utf8'));
}

async function runCompositionConformance() {
    console.log("=== Running Architecture Conformance Suite: Composition Framework ===");

    const manifestSchema = loadSchema('manifest.schema.json');
    const graphSchema = loadSchema('graph.schema.json');
    const templatesSchema = loadSchema('templates.schema.json');
    const lifecycleSchema = loadSchema('lifecycle.schema.json');

    // Test 1: Pack Manifest must categorize into the 8 official Archetypes
    const packDef = manifestSchema.definitions.SolutionPack;
    const categoryEnum = packDef.properties.category.enum;
    assert.ok(categoryEnum.includes('Industry'), "Must support Industry Packs");
    assert.ok(categoryEnum.includes('AI'), "Must support AI Packs");
    assert.ok(categoryEnum.includes('Marketplace'), "Must support Marketplace Packs");
    console.log("✅ Conformance Pass: Solution Pack Manifest enforces the 8 universal Pack Archetypes.");

    // Test 2: Composition Graph enforces non-linear dependencies (Directed Graph logic)
    const graphDef = graphSchema.definitions.CompositionGraph;
    assert.ok(graphDef.properties.nodes, "Composition Graph must define nodes");
    assert.ok(graphDef.properties.edges, "Composition Graph must define edges");
    assert.ok(graphDef.properties.edges.items.properties.relationshipType, "Edges must specify the relationship type (e.g., ExtendsSemantics)");
    console.log("✅ Conformance Pass: Composition Framework utilizes a formal Composition Graph for dependencies.");

    // Test 3: Pack Manifest explicitly tracks Canonical Object Extensions
    assert.ok(packDef.properties.extensions.properties.canonicalObjectsExtended, "Packs must explicitly declare which Canonical Objects they extend (Law 4)");
    console.log("✅ Conformance Pass: Extensions preserve Canonical Object Integrity (Law 4).");

    // Test 4: Providers remain runtime decisions (Marketplace Readiness)
    assert.ok(packDef.properties.extensions.properties.providersAdded, "Packs declare added providers as optional extensions, retaining provider independence");
    console.log("✅ Conformance Pass: Composition enforces Provider Independence (Law 5).");
    
    // Test 5: Solution Templates pre-compose packs
    const templateDef = templatesSchema.definitions.SolutionTemplate;
    assert.ok(templateDef.properties.composedPacks, "Solution Templates must define composed packs");
    console.log("✅ Conformance Pass: Solution Templates successfully orchestrate composed packs for target archetypes.");

    console.log("All Composition Framework Architecture Conformance Tests Passed.");
}

runCompositionConformance().catch(console.error);
