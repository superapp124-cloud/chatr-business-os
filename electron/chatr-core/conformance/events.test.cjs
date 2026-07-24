
const { bus } = require('../events/bus.cjs');

describe('EVENT_SPEC_v1 Conformance', () => {
    describe('Canonical Event Vocabulary', () => {
        it('Accepts canonical events', () => {
            const validEventPayload = { intent_id: 'uuid-123' };
            expect(() => {
                // Uses publish instead of raw emit to go through schema validation
                bus.publish('intent.created', validEventPayload, { source: 'Kernel' });
            }).not.toThrow();
        });

        it('Rejects non-canonical events (Closed Vocabulary Rule)', () => {
            expect(() => {
                bus.publish('magic.intent_happened', {});
            }).toThrow(); // Should throw from validateEventType in schema.cjs
        });
        
        it('Rejects events without required envelope fields', () => {
            expect(() => {
                // Invalid type for source (should be string)
                bus.publish('intent.created', {}, { source: 123 });
            }).toThrow('Event envelope requires source');
        });
    });
});
