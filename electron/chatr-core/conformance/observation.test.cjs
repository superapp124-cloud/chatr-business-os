





const { bus } = require('../events/bus.cjs');

describe('OBSERVATION_RUNTIME Conformance', () => {
    let ObservationRuntime;
    let persistence;

    beforeEach(() => {
        ObservationRuntime = require('../services/observation-service.cjs');
        persistence = require('../db/persistence.cjs');
        
        vi.clearAllMocks();
    });

    it('Observation Runtime exposes required Adapter Registry interface', () => {
        expect(typeof ObservationRuntime.registerAdapter).toBe('function');
        expect(typeof ObservationRuntime.start).toBe('function');
    });

    it('Adapters must implement the standard driver interface', () => {
        const invalidAdapter = { start: () => {} }; // Missing initialize, stop, etc.
        expect(() => {
            ObservationRuntime.registerAdapter('weather', invalidAdapter);
        }).toThrow('ADAPTER_VIOLATION: Adapter is missing required methods');
    });

    it('Observation Runtime emits ONLY world.changed events', () => {
        const validAdapter = {
            initialize: () => {},
            start: () => {},
            stop: () => {},
            health: () => ({ status: 'ok' }),
            normalize: (raw) => ({ subject: 'weather', payload: raw }),
            capabilities: () => ['weather']
        };
        
        ObservationRuntime.registerAdapter('test_weather', validAdapter);
        
        const emitSpy = vi.spyOn(bus, 'publish');
        
        // Simulate the adapter receiving data
        ObservationRuntime._handleRawObservation('test_weather', { temp: 25 });
        
        expect(emitSpy).toHaveBeenCalledTimes(1);
        const [eventName, payload] = emitSpy.mock.calls[0];
        expect(eventName).toBe('world.changed');
        expect(payload.source).toBe('test_weather');
        expect(payload.payload.temp).toBe(25);
    });

    it('Observation Runtime persists the raw observation before publishing', () => {
        const validAdapter = {
            initialize: () => {},
            start: () => {},
            stop: () => {},
            health: () => ({ status: 'ok' }),
            normalize: (raw) => ({ subject: 'weather', payload: raw }),
            capabilities: () => ['weather']
        };
        
        const appendSpy = vi.spyOn(persistence, 'append');
        
        ObservationRuntime.registerAdapter('test_weather2', validAdapter);
        ObservationRuntime._handleRawObservation('test_weather2', { temp: 30 });
        
        expect(appendSpy).toHaveBeenCalledTimes(1);
        const [collection, data] = appendSpy.mock.calls[0];
        expect(collection).toBe('observation_log');
        expect(data.adapter).toBe('test_weather2');
        expect(data.raw_payload.temp).toBe(30);
        expect(data.normalized_payload.payload.temp).toBe(30);
    });

    it('Observation Runtime never mutates Intent Objects directly', () => {
        // This is proven statically by the linter, but we also verify it doesn't expose any methods to do so.
        expect(ObservationRuntime.updateIntent).toBeUndefined();
    });
});
