const { bus } = require('../events/bus.cjs');

describe('VERIFICATION_RUNTIME Conformance', () => {
    let VerificationRuntime;
    let persistence;

    beforeEach(() => {
        VerificationRuntime = require('../services/verification-service.cjs');
        persistence = require('../db/persistence.cjs');
        
        // Stateful mock for obligations
        const dbState = { obligations: new Map(), evidence: [] };
        vi.spyOn(persistence, 'insertRecord').mockImplementation((table, data) => {
            if (table === 'verification_obligations') dbState.obligations.set(data.id, data);
            if (table === 'verification_evidence') dbState.evidence.push(data);
        });

        // Mock persistence DB for reads
        persistence.db = {
            prepare: vi.fn((query) => {
                return {
                    get: vi.fn((id) => {
                        if (query.includes('verification_obligations')) {
                            return dbState.obligations.get(id);
                        }
                        return {};
                    }),
                    all: vi.fn((id) => {
                        if (query.includes('verification_evidence')) {
                            return dbState.evidence.filter(e => e.obligation_id === id);
                        }
                        return [];
                    }),
                    run: vi.fn()
                };
            })
        };
        
        vi.clearAllMocks();
    });

    it('Verification Runtime does not expose Intent Object mutation methods', () => {
        expect(VerificationRuntime.updateIntent).toBeUndefined();
        expect(VerificationRuntime.mutateState).toBeUndefined();
    });

    it('Verification Runtime emits canonical verification events', async () => {
        const emitSpy = vi.spyOn(bus, 'publish');
        
        VerificationRuntime.registerStrategy('email_receipt', '1.0', (obligation, evidenceList) => {
            if (evidenceList.length > 0) return { status: 'confirmed', confidence: 0.99 };
            return { status: 'insufficient_evidence', confidence: 0.0 };
        });

        // Simulating the kernel passing an obligation
        const obl = await VerificationRuntime._createObligation({
            intentId: 'intent-456',
            executionId: 'exec-789',
            strategy: 'email_receipt',
            strategyVersion: '1.0',
            requiredEvidence: ['receipt']
        });

        // Add evidence
        await VerificationRuntime._acceptEvidence(obl.id, {
            source: 'email.adapter',
            type: 'receipt',
            correlationId: 'exec-789',
            payload: { amount: 100 },
            checksum: 'abc'
        });

        const events = emitSpy.mock.calls.map(call => call[0]);
        // Expect at least verification.evidence.accepted and verification.confirmed
        expect(events).toContain('verification.evidence.accepted');
        expect(events).toContain('verification.confirmed');
        
        for (const ev of events) {
            expect(ev.startsWith('verification.')).toBe(true);
        }
    });

    it('Verification Runtime persists obligations and append-only evidence', async () => {
        VerificationRuntime.registerStrategy('test_strategy', '1.0', () => {
            return { status: 'failed', confidence: 1.0 };
        });

        const obl = await VerificationRuntime._createObligation({
            intentId: 'intent-999',
            executionId: 'exec-999',
            strategy: 'test_strategy',
            strategyVersion: '1.0',
            requiredEvidence: ['doc']
        });

        expect(persistence.insertRecord).toHaveBeenCalled();
        const oblCall = persistence.insertRecord.mock.calls.find(c => c[0] === 'verification_obligations');
        expect(oblCall).toBeDefined();
        expect(oblCall[1].id).toBe(obl.id);
        
        await VerificationRuntime._acceptEvidence(obl.id, {
            source: 'test.adapter',
            type: 'doc',
            correlationId: 'exec-999',
            payload: { text: 'test' },
            checksum: 'xyz'
        });

        const evCall = persistence.insertRecord.mock.calls.find(c => c[0] === 'verification_evidence');
        expect(evCall).toBeDefined();
        expect(evCall[1].obligation_id).toBe(obl.id);
        expect(evCall[1].checksum).toBe('xyz');
    });
});
