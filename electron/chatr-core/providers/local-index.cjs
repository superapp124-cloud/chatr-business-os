'use strict';

class LocalIndexProvider {
  constructor() {
    this.name = 'LocalIndexProvider';
  }

  async execute(capabilityId, parameters, context) {
    if (capabilityId === 'System.Search') {
      // Stub for vector/index search
      return {
        success: true,
        results: [
          { id: 'mock_doc_1', score: 0.98, snippet: 'Mock indexed document' }
        ]
      };
    }

    throw new Error(`Unsupported capability: ${capabilityId}`);
  }
}

module.exports = { LocalIndexProvider };
