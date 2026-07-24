const assert = require('assert');
const { CapabilityRegistry, ProviderRegistry } = require('../capabilities/registry.cjs');
const { ExecutionStrategy, ProviderStrategy } = require('../execution/interfaces.cjs');

// Mock telemetry 
const Telemetry = require('../providers/telemetry.cjs');

// Dummy implementation of Provider Strategy that selects based on Telemetry
class SmartProviderStrategy extends ProviderStrategy {
    async selectProvider(intent, candidateProviders) {
        // Find first healthy provider
        for (const p of candidateProviders) {
            const providerId = p.manifest.identity.id;
            const isCircuitOpen = Telemetry.isCircuitOpen(`conn_default_${providerId}`);
            if (!isCircuitOpen) {
                return p;
            }
        }
        return null;
    }
}

// Dummy implementation of Execution Strategy
class MixedExecutionStrategy extends ExecutionStrategy {
    constructor() {
        super();
        this.providerStrategy = new SmartProviderStrategy();
    }

    async execute(intent) {
        const capabilityId = intent.capability;
        const requiredCapability = CapabilityRegistry.getCapability(capabilityId, '1.0.0');
        
        if (!requiredCapability) {
            return { type: 'ErrorOutcome', status: 'Failed', reason: 'Capability not found' };
        }

        const candidates = ProviderRegistry.getCompatibleProviders(requiredCapability.manifest);
        
        if (candidates.length === 0) {
            return { type: 'LocalOutcome', status: 'Failed', reason: 'No compatible execution paths' };
        }

        // Try Provider Execution first
        const selectedProvider = await this.providerStrategy.selectProvider(intent, candidates);
        
        if (selectedProvider) {
            const providerId = selectedProvider.manifest.identity.id;
            
            // Simulate Provider Execution
            if (providerId === 'mock.webhook.payment' && intent.simulateFailure) {
                // Record failure in telemetry
                Telemetry.recordFailure(`conn_default_${providerId}`, providerId, true);
                
                return { 
                    type: 'ProviderOutcome', 
                    status: 'Failed', 
                    providerId, 
                    retryable: true 
                };
            }
            
            // Success
            Telemetry.recordSuccess(`conn_default_${providerId}`, providerId, 100);
            return { 
                type: 'ProviderOutcome', 
                status: 'Success', 
                providerId 
            };
        }

        // Fallback to Human Execution
        return { 
            type: 'HumanOutcome', 
            status: 'Pending', 
            reason: 'All providers exhausted. Escalate to human.' 
        };
    }
}

async function runTests() {
    console.log("=== Running Provider Platform Conformance Tests ===");
    const strategy = new MixedExecutionStrategy();
    
    // Test 1: Successful provider execution
    const intent1 = { capability: 'payment.process', simulateFailure: false };
    const outcome1 = await strategy.execute(intent1);
    assert.strictEqual(outcome1.type, 'ProviderOutcome');
    assert.strictEqual(outcome1.status, 'Success');
    console.log("✅ Test 1 Passed: Successful Provider Execution");

    // Test 2: Provider failure resulting in ProviderOutcome
    const intent2 = { capability: 'payment.process', simulateFailure: true };
    const outcome2 = await strategy.execute(intent2);
    assert.strictEqual(outcome2.type, 'ProviderOutcome');
    assert.strictEqual(outcome2.status, 'Failed');
    console.log("✅ Test 2 Passed: Provider Failure yielding ExecutionOutcome");

    // Test 3: Circuit Breaker Open -> Fallback to Human
    // Trip the circuit breaker (3 failures required by telemetry.cjs)
    await strategy.execute(intent2); // Failure 2
    await strategy.execute(intent2); // Failure 3 -> Circuit Open!
    
    // Now try to execute again. The SmartProviderStrategy should skip the open circuit.
    // If no other providers are available, MixedExecutionStrategy falls back to Human.
    const intent3 = { capability: 'payment.process', simulateFailure: false };
    const outcome3 = await strategy.execute(intent3);
    assert.strictEqual(outcome3.type, 'HumanOutcome');
    assert.strictEqual(outcome3.status, 'Pending');
    console.log("✅ Test 3 Passed: Circuit Breaker Open triggered Human Fallback");

    console.log("All Provider Platform Conformance Tests Passed.");
}

runTests().catch(console.error);
