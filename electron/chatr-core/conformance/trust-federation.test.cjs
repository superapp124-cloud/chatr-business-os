const assert = require('assert');

// Federation Services
const TrustService = require('../federation/trust.cjs');
const IdentityFederation = require('../federation/identity.cjs');
const TrustGateway = require('../federation/gateway.cjs');
const ExchangeFederation = require('../federation/exchange.cjs');
const Package = require('../exchange/package.cjs');

async function runTests() {
    console.log("=== Running Architecture Conformance Suite: Trust & Federation ===");

    const orgA = "Org_A_Healthcare";
    const orgB = "Org_B_Enterprise";

    // 1. Explicit Trust Negotiation
    const proposedTrust = TrustService.proposeTrust(orgA, orgB, ['health.appointment', 'health.records']);
    assert.strictEqual(proposedTrust.lifecycleState, "Proposed");
    
    TrustService.activateTrust(proposedTrust.id, { identityTrust: "High", packageTrust: "High" });
    assert.strictEqual(proposedTrust.lifecycleState, "Active");
    console.log("✅ Trust Service established explicit, versioned, and capability-scoped Trust.");

    // 2. Trust Gateway Interception (Sole cross-org path)
    const remoteAssertion = { issuer: orgA, subject: 'dr_smith@orga.com', signature: 'valid_crypto_sig' };
    const payload = { action: "book_appointment" };

    // Successful route
    const gatewayResult = await TrustGateway.processIncoming(payload, remoteAssertion, orgA, orgB, 'health.appointment');
    assert.strictEqual(gatewayResult.status, "ROUTED");
    assert.ok(gatewayResult.session.sessionId);
    assert.strictEqual(gatewayResult.executingPrincipal.type, "ExternalSystem"); // Mapped identity
    console.log("✅ Trust Gateway verified scoped trust, mapped identity, and established a Federation Session.");

    // Failed route (Capability not in scoped trust)
    try {
        await TrustGateway.processIncoming(payload, remoteAssertion, orgA, orgB, 'finance.payroll');
        assert.fail("Should have rejected out-of-scope capability");
    } catch (e) {
        assert.ok(e.message.includes('not trusted for capability'));
    }
    console.log("✅ Trust Gateway successfully rejected requests outside the explicitly negotiated trust scope.");

    // 3. Package Federation (End-to-End Lineage Preservation)
    const remotePackage = new Package({
        publisher: 'orga-clinical',
        namespace: 'fhir',
        name: 'scheduler',
        version: '1.0.0',
        channel: 'Stable',
        type: 'Capability'
    });

    const importedAsset = ExchangeFederation.importPackage(remotePackage, orgA);
    assert.strictEqual(importedAsset.originalPackage.identity.hash, remotePackage.identity.hash);
    
    // Simulate Tampering
    const tamperedPackage = new Package({ publisher: 'orga-clinical', namespace: 'fhir', name: 'scheduler', version: '1.0.0', channel: 'Stable', type: 'Capability' });
    tamperedPackage.identity.hash = 'fake_hash_123'; // Tamper
    
    try {
        ExchangeFederation.importPackage(tamperedPackage, orgA);
        assert.fail("Should have rejected tampered package");
    } catch(e) {
        assert.ok(e.message.includes('Cryptographic identity mismatch'));
    }
    console.log("✅ Exchange Federation preserved End-to-End Lineage and rejected tampered packages.");

    console.log("All Trust & Federation Architecture Conformance Tests Passed.");
}

runTests().catch(console.error);
