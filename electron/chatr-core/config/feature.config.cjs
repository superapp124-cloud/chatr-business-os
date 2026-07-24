'use strict';

/**
 * CHATR Kernel — Feature Configuration
 * Controls which modules and capabilities are active.
 */
module.exports = {
  modules: {
    conversation: { version: '1.0.0', status: 'stable' },
    sense:        { version: '0.3.0', status: 'stable' },
    knowledge:    { version: '0.1.0', status: 'stable' },
    time:         { version: '0.1.0', status: 'stable' },
    semantic:     { version: '0.1.0', status: 'stable' },
    memory:       { version: '0.1.0', status: 'reserved' },
    judgment:     { version: '0.1.0', status: 'reserved' },
    capabilities: { version: '0.1.0', status: 'reserved' },
    reality:      { version: '0.1.0', status: 'reserved' },
    learning:     { version: '0.1.0', status: 'reserved' }
  },
  streaming: {
    enabled: true,
  },
  recovery: {
    enabled: true,                    // Hook built — unused in v0.1
  },
  metrics: {
    enabled: true,
  },
};
