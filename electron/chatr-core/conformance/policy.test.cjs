const { bus } = require('../events/bus.cjs');

describe('POLICY_SERVICE Conformance', () => {
    let PolicyService;
    let persistence;

    beforeEach(() => {
        PolicyService = require('../services/policy-service.cjs');
        persistence = require('../db/persistence.cjs');
        vi.clearAllMocks();
        
        // Stateful mock for evaluations
        const dbState = { evaluations: new Map() };
        vi.spyOn(persistence, 'insertRecord').mockImplementation((table, data) => {
            if (table === 'policy_evaluations') dbState.evaluations.set(data.id, data);
        });
    });

    it('Policy Service performs no network calls or I/O', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {});
        const emitSpy = vi.spyOn(bus, 'publish');
        
        PolicyService.registerPolicy('test.policy', '1.0', (facts) => {
            return {
                matched: true,
                constraintsSatisfied: true,
                authorizationState: 'permitted',
                confidence: 1.0,
                reasons: []
            };
        });

        await PolicyService._evaluatePolicies({
            intentId: 'intent-111',
            policyIds: [{ id: 'test.policy', version: '1.0' }],
            facts: {}
        });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalled();
        const ev = emitSpy.mock.calls[0];
        expect(ev[0]).toBe('policy.evaluated');
        expect(ev[1].evaluations.length).toBe(1);
    });

    it('Policy Service is deterministic and evaluates multiple policies', async () => {
        PolicyService.registerPolicy('user.autopay', '1.0', (facts) => {
            const billOk = facts.billAmount <= 5000;
            return {
                matched: true,
                constraintsSatisfied: billOk,
                authorizationState: billOk ? 'permitted' : 'prohibited',
                confidence: 1.0,
                reasons: [{
                    rule: 'billAmount', operator: '<=', expected: 5000, actual: facts.billAmount, satisfied: billOk
                }]
            };
        });

        PolicyService.registerPolicy('org.safety', '1.0', (facts) => {
            return {
                matched: true,
                constraintsSatisfied: facts.identityVerified,
                authorizationState: facts.identityVerified ? 'permitted' : 'prohibited',
                confidence: 1.0,
                reasons: [{
                    rule: 'identityVerified', operator: '==', expected: true, actual: facts.identityVerified, satisfied: facts.identityVerified
                }]
            };
        });

        const evals = await PolicyService._evaluatePolicies({
            intentId: 'intent-222',
            policyIds: [
                { id: 'user.autopay', version: '1.0' },
                { id: 'org.safety', version: '1.0' }
            ],
            facts: { billAmount: 1340, identityVerified: true }
        });

        expect(evals.length).toBe(2);
        expect(evals[0].authorizationState).toBe('permitted');
        expect(evals[1].authorizationState).toBe('permitted');
        
        expect(persistence.insertRecord).toHaveBeenCalledTimes(2);

        // Deterministic check
        const evals2 = await PolicyService._evaluatePolicies({
            intentId: 'intent-222',
            policyIds: [
                { id: 'user.autopay', version: '1.0' },
                { id: 'org.safety', version: '1.0' }
            ],
            facts: { billAmount: 1340, identityVerified: true }
        });
        
        expect(evals[0].authorizationState).toBe(evals2[0].authorizationState);
        expect(evals[0].reasons[0].actual).toBe(evals2[0].reasons[0].actual);
    });
});
