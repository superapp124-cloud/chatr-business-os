/**
 * @interface IAIProvider
 * Defines the standard contract for any AI model provider in the CHATR ecosystem.
 */
export class AIProvider {
  /**
   * Generate a complete text response.
   * @param {Array} messages - Chat context
   * @param {Object} options - Generation options (temp, tokens, etc)
   * @returns {Promise<string>}
   */
  async generate(messages, options) {
    throw new Error('Not implemented');
  }

  /**
   * Stream a response token-by-token.
   * @param {Array} messages - Chat context
   * @param {Object} options - Generation options
   * @param {Function} onToken - Callback when a token is received
   * @returns {Promise<void>}
   */
  async stream(messages, options, onToken) {
    throw new Error('Not implemented');
  }

  /**
   * Generate vector embeddings for memory/search.
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embeddings(text) {
    throw new Error('Not implemented');
  }

  /**
   * Return the list of supported tools for this provider.
   * @returns {Array}
   */
  tools() {
    return [];
  }

  /**
   * Check if the provider is reachable and healthy.
   * @returns {Promise<boolean>}
   */
  async health() {
    throw new Error('Not implemented');
  }
}
