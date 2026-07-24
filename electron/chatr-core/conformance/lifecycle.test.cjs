

const IntentLifecycle = require('../kernel/intent-lifecycle.cjs');

describe('LIFECYCLE_SPEC_v1 Conformance', () => {
    let dummyIntent;

    beforeEach(() => {
        dummyIntent = {
            id: 'test-uuid',
            lifecycle: {
                phase: 'DRAFT',
                condition: 'HEALTHY'
            }
        };
    });

    describe('Legal Transitions', () => {
        it('DRAFT -> PLANNED (Kernel Authority)', () => {
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'PLANNED', 'Kernel');
            }).not.toThrow();
            expect(dummyIntent.lifecycle.phase).toBe('PLANNED');
        });

        it('PLANNED -> EXECUTING (Kernel Authority)', () => {
            dummyIntent.lifecycle.phase = 'PLANNED';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'EXECUTING', 'Kernel');
            }).not.toThrow();
            expect(dummyIntent.lifecycle.phase).toBe('EXECUTING');
        });

        it('EXECUTING -> VERIFYING (Kernel Authority)', () => {
            dummyIntent.lifecycle.phase = 'EXECUTING';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'VERIFYING', 'Kernel');
            }).not.toThrow();
            expect(dummyIntent.lifecycle.phase).toBe('VERIFYING');
        });

        it('VERIFYING -> COMPLETED (Kernel Authority)', () => {
            dummyIntent.lifecycle.phase = 'VERIFYING';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'COMPLETED', 'Kernel');
            }).not.toThrow();
            expect(dummyIntent.lifecycle.phase).toBe('COMPLETED');
        });

        it('COMPLETED -> STEWARDED (User Authority)', () => {
            dummyIntent.lifecycle.phase = 'COMPLETED';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'STEWARDED', 'User');
            }).not.toThrow();
            expect(dummyIntent.lifecycle.phase).toBe('STEWARDED');
        });
        
        it('STEWARDED -> EXECUTING (Kernel Authority)', () => {
            dummyIntent.lifecycle.phase = 'STEWARDED';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'EXECUTING', 'Kernel');
            }).not.toThrow();
            expect(dummyIntent.lifecycle.phase).toBe('EXECUTING');
        });
    });

    describe('Forbidden Transitions', () => {
        it('DRAFT -> STEWARDED is explicitly forbidden', () => {
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'STEWARDED', 'User');
            }).toThrow('LIFECYCLE_VIOLATION');
        });

        it('DRAFT -> EXECUTING is explicitly forbidden', () => {
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'EXECUTING', 'Kernel');
            }).toThrow('LIFECYCLE_VIOLATION');
        });

        it('EXECUTING -> COMPLETED is explicitly forbidden (Must pass VERIFYING)', () => {
            dummyIntent.lifecycle.phase = 'EXECUTING';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'COMPLETED', 'Kernel');
            }).toThrow('LIFECYCLE_VIOLATION');
        });
        
        it('ARCHIVED -> DRAFT is explicitly forbidden (Terminal State)', () => {
            dummyIntent.lifecycle.phase = 'ARCHIVED';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'DRAFT', 'Kernel');
            }).toThrow('LIFECYCLE_VIOLATION');
        });
    });
    
    describe('Authority Constraints', () => {
        it('COMPLETED -> STEWARDED is forbidden for Kernel (Must be User)', () => {
            dummyIntent.lifecycle.phase = 'COMPLETED';
            expect(() => {
                IntentLifecycle.transition(dummyIntent, 'STEWARDED', 'Kernel');
            }).toThrow('AUTHORITY_VIOLATION');
        });
    });
});
