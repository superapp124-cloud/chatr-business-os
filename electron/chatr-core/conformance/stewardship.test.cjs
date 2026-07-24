const { bus } = require('../events/bus.cjs');

describe('STEWARDSHIP_SERVICE Conformance', () => {
    let StewardshipService;
    let persistence;
    let publishSpy;

    beforeEach(() => {
        StewardshipService = require('../services/stewardship-service.cjs');
        persistence = require('../db/persistence.cjs');
        vi.clearAllMocks();
        
        publishSpy = vi.spyOn(bus, 'publish');
        const dbState = { checkpoints: new Map() };
        vi.spyOn(persistence, 'insertRecord').mockImplementation((table, data) => {
            if (table === 'lifecycle_checkpoints') dbState.checkpoints.set(data.id, data);
        });
    });

    it('Stewardship Service proposes lifecycle transitions based on events', async () => {
        const intent = {
            id: 'intent-abc',
            phase: 'Draft',
            condition: 'Sleeping'
        };

        // Emit trigger
        await StewardshipService.evaluateLifecycle(intent, 'User', {});

        expect(publishSpy).toHaveBeenCalled();
        const call = publishSpy.mock.calls.find(c => c[0] === 'lifecycle.transition.proposed');
        expect(call).toBeDefined();
        const payload = call[1];
        
        expect(payload.intent_id).toBe('intent-abc');
        expect(payload.before_phase).toBe('Draft');
        expect(payload.after_phase).toBe('Active');
        expect(payload.after_condition).toBe('WaitingPolicy');
        expect(payload.trigger_type).toBe('User');
        expect(payload.transition_reason).toBe('User activated draft intent');
    });

    it('Stewardship Service logs append-only LifecycleCheckpoints', async () => {
        const chkData = {
            intent_id: 'intent-xyz',
            before_phase: 'Active',
            before_condition: 'Healthy',
            trigger_type: 'Observation',
            after_phase: 'Stewarded',
            after_condition: 'WaitingVerification',
            transition_reason: 'Testing checkpointing',
            decision_id: 'dec-111'
        };

        const chk = await StewardshipService.logCheckpoint(chkData);
        
        expect(persistence.insertRecord).toHaveBeenCalled();
        const insertCall = persistence.insertRecord.mock.calls.find(c => c[0] === 'lifecycle_checkpoints');
        expect(insertCall).toBeDefined();
        
        const insertedData = insertCall[1];
        expect(insertedData.id).toBe(chk.id);
        expect(insertedData.trigger_type).toBe('Observation');
        expect(insertedData.decision_id).toBe('dec-111');
        expect(insertedData.kernel_version).toBeDefined();
    });
});
