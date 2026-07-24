const assert = require('assert');
const Package = require('../exchange/package.cjs');
const CatalogService = require('../exchange/catalog.cjs');
const PublishingPipeline = require('../exchange/publisher.cjs');
const InstallationEngine = require('../exchange/installer.cjs');

async function runTests() {
    console.log("=== Running Architecture Conformance Suite: Platform Exchange ===");

    // 1. Create a Bundle Package
    const bundlePkg = new Package({
        publisher: 'acme-health',
        namespace: 'clinical',
        name: 'fhir-bundle',
        version: '2.1.0',
        channel: 'Stable',
        type: 'Bundle',
        provides: [{ capability: 'health.appointment' }],
        requires: [{ capability: 'payment.process' }]
    });

    bundlePkg.setProvenance('github.com/acme/fhir', 'a1b2c3d4', 'github-actions');
    assert.strictEqual(bundlePkg.lifecycleState, "Draft");
    assert.ok(bundlePkg.identity.hash);
    console.log("✅ Universal Package instantiated with provenance.");

    // 2. Supply Chain Publishing Pipeline (Governance Gated)
    await PublishingPipeline.publish(bundlePkg, 'APPROVED');
    assert.strictEqual(bundlePkg.lifecycleState, "Published");

    // Attempt to publish without governance
    const roguePkg = new Package({ publisher: 'rogue', namespace: 'core', name: 'hack', version: '1.0', channel: 'Stable', type: 'Capability' });
    try {
        await PublishingPipeline.publish(roguePkg, 'DENIED');
        assert.fail("Should have blocked publishing");
    } catch (e) {
        assert.ok(e.message.includes('Governance'));
    }
    console.log("✅ Publishing Pipeline enforced Supply Chain Lifecycle & Governance.");

    // 3. Dual Catalog Verification
    const urn = bundlePkg.getURN();
    const discoveryHits = CatalogService.searchDiscovery('fhir-bundle');
    assert.strictEqual(discoveryHits.length, 1);
    
    const resolutionData = CatalogService.getResolutionData(urn);
    assert.ok(resolutionData.provides);
    console.log("✅ Dual Catalogs separated Discovery metadata from Resolution dependencies.");

    // 4. Platform Manifest & Transactional Installation
    const manifest = {
        platform: { kernel: "1.0", planner: "1.5" },
        packages: [urn]
    };

    const targetScope = "ws_project_apollo";
    const installerPrincipal = { id: "prin_admin_001" };

    const installRecord = await InstallationEngine.install(manifest, targetScope, installerPrincipal);
    assert.strictEqual(installRecord.result, 'SUCCESS');
    assert.ok(installRecord.installationPlanHash);
    assert.strictEqual(installRecord.packagesInstalled[0], urn);
    console.log("✅ Installation Engine completed a Transactional Deployment and produced an immutable InstallationRecord.");

    // 5. Test Rollback
    const failingPkg = new Package({
        publisher: 'acme-health',
        namespace: 'clinical',
        name: 'fail_runtime',
        version: '1.0.0',
        channel: 'Stable',
        type: 'Capability',
        requires: [{ capability: 'missing_provider', runtimeCheck: 'Strict' }]
    });
    await PublishingPipeline.publish(failingPkg, 'APPROVED');
    
    const failManifest = {
        platform: { kernel: "1.0" },
        packages: [failingPkg.getURN()]
    };

    try {
        await InstallationEngine.install(failManifest, targetScope, installerPrincipal);
        assert.fail("Installation should have failed runtime validation");
    } catch (e) {
        assert.ok(e.message.includes('Runtime Validation Failed'));
    }
    // Look up the last installation to ensure it rolled back
    const allInstalls = Array.from(InstallationEngine.installations.values());
    const failedInstall = allInstalls[allInstalls.length - 1];
    assert.strictEqual(failedInstall.result, 'ROLLED_BACK');
    assert.ok(failedInstall.rollbackReference);
    console.log("✅ Installation Engine successfully executed a Rollback upon Runtime Validation failure.");

    console.log("All Platform Exchange Architecture Conformance Tests Passed.");
}

runTests().catch(console.error);
