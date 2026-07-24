const assert = require('assert');

// Enterprise Control Plane Services
const OrganizationService = require('../enterprise/organization.cjs');
const IdentityService = require('../enterprise/identity.cjs');
const AuthorizationService = require('../enterprise/authorization.cjs');
const SecretsService = require('../enterprise/secrets.cjs');
const EnterpriseRegistry = require('../enterprise/registry.cjs');

async function runTests() {
    console.log("=== Running Architecture Conformance Suite: Three-Plane Separation ===");

    // 1. Organization & Identity (Control Plane Setup)
    const workspace = OrganizationService.createWorkspace('Project Apollo', {
        enterprise: 'Acme Corp',
        region: 'US-East',
        businessUnit: 'Engineering',
        department: 'Platform',
        project: 'Apollo'
    });
    assert.ok(workspace.id.startsWith('ws_'));
    console.log("✅ Organization Workspace Created");

    const aiAgent = IdentityService.createPrincipal('AIAgent', 'ext_agent_001');
    const humanAdmin = IdentityService.createPrincipal('Human', 'user_admin_001');
    assert.strictEqual(aiAgent.type, 'AIAgent');
    console.log("✅ Principals Registered");

    // 2. Resource & Relationship Modeling (Enterprise Registry)
    const capabilityResource = {
        id: "cap_travel_booking",
        type: "Capability",
        version: "1.0",
        owner: humanAdmin,
        workspace: workspace.id,
        classification: "Internal",
        trustLevel: "Verified"
    };
    EnterpriseRegistry.register(capabilityResource);

    const intentGraphResource = {
        id: "graph_123",
        type: "IntentGraph",
        version: "1.0",
        owner: aiAgent,
        workspace: workspace.id,
        classification: "Internal",
        trustLevel: "Experimental"
    };
    EnterpriseRegistry.register(intentGraphResource);
    
    // Model relationship
    EnterpriseRegistry.addRelationship(intentGraphResource.id, 'uses', capabilityResource.id);
    const downstream = EnterpriseRegistry.getDownstream(intentGraphResource.id, 'uses');
    assert.strictEqual(downstream.length, 1);
    assert.strictEqual(downstream[0].targetId, capabilityResource.id);
    console.log("✅ Enterprise Registry modeled explicit resource relationships");

    // 3. Authorization Invariants
    const canAgentRead = AuthorizationService.can(aiAgent, 'read', intentGraphResource);
    const canAgentApprove = AuthorizationService.can(aiAgent, 'approve', capabilityResource);
    
    assert.strictEqual(canAgentRead, true);
    assert.strictEqual(canAgentApprove, false); // AI Agents cannot approve
    console.log("✅ Authorization Service centralized policy enforcement");

    // 4. Secrets Shielding and Connection Lifecycle
    const connectionConfig = { classification: "Restricted" };
    
    // AI Agent requests connection
    const connection = SecretsService.requestConnection(aiAgent, 'cap_travel_booking', connectionConfig);
    assert.strictEqual(connection.lifecycleState, "Requested");
    
    // Governance Decision (Human Admin Approves)
    const govDecision = {
        id: "gov_decision_001",
        resourceId: connection.id,
        resourceVersion: connection.version,
        policy: "REQ_APPROVE_EXT",
        decision: "APPROVED",
        approver: humanAdmin,
        timestamp: new Date().toISOString(),
        signature: "crypto_sig_mock"
    };

    // Human Admin approves connection
    SecretsService.approveConnection(connection.id, govDecision);
    assert.strictEqual(connection.lifecycleState, "Approved");

    // Platform configures it with real secrets (e.g., OAuth tokens)
    SecretsService.configureConnection(connection.id, { client_secret: 'SUPER_SECRET_TOKEN' });
    
    // Execution Plane requests handle to execute
    const handle = SecretsService.getSecureHandle(connection.id);
    
    // Architectural Proof: The handle contains NO RAW SECRETS.
    assert.ok(handle.handle.startsWith('handle_conn_'));
    assert.strictEqual(handle.client_secret, undefined);
    assert.strictEqual(handle.providerId, 'cap_travel_booking');
    console.log("✅ Secrets Service strictly shielded raw secrets from the Execution Plane");

    console.log("All Three-Plane Architecture Conformance Tests Passed.");
}

runTests().catch(console.error);
