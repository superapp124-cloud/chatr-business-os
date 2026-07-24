const { spawn } = require('child_process');

class McpTransportStrategy {
  async initialize() {}
  async shutdown() {}
  
  validate(manifest, parameters) {
    return true; // Simplified for MVP
  }
  
  collectEvidence(rawResult) {
    // Must return an array for UI bridge
    return [rawResult.result]; 
  }

  async compensate() {}

  /**
   * Execute an MCP capability.
   * @param {object} providerInstance - The provider instance metadata.
   * @param {string} capabilityId - The tool/capability ID to call.
   * @param {object} parameters - The parameters for the tool.
   * @param {object} context - Execution context.
   */
  async execute(providerInstance, capabilityId, parameters, context = {}) {
    // 1. Security sandboxing placeholder
    if (providerInstance && providerInstance.permissions && !providerInstance.permissions.includes('mcp.execute')) {
      throw new Error(`Provider ${providerInstance.id} lacks 'mcp.execute' permission.`);
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;

      // Mock MCP server via inline Node script if no real server path is provided
      const isMock = !(providerInstance && providerInstance.mcpServerPath);
      const scriptArgs = isMock ? ['-e', `
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, terminal: false });
        rl.on('line', (line) => {
          try {
            const req = JSON.parse(line);
            if (req.method === 'callTool') {
              const res = { 
                jsonrpc: '2.0', 
                id: req.id, 
                result: { 
                  content: [{ type: 'text', text: 'Mock executed ' + req.params.name }],
                  success: true, 
                  mock: true, 
                  receivedArgs: req.params.arguments 
                } 
              };
              console.log(JSON.stringify(res));
            }
          } catch(e) {}
        });
      `] : [providerInstance.mcpServerPath];

      const child = spawn(process.execPath, scriptArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let responseData = '';
      let errorData = '';

      const requestPayload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'callTool',
        params: {
          name: capabilityId,
          arguments: parameters || {}
        }
      };

      child.stdout.on('data', (chunk) => {
        responseData += chunk.toString();
        try {
          const lines = responseData.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = JSON.parse(line);
            if (parsed.id === requestPayload.id) {
              if (!isResolved) {
                isResolved = true;
                child.kill();
                if (parsed.error) {
                  reject(new Error(`MCP Error: ${parsed.error.message}`));
                } else {
                  resolve({
                    status: 'success',
                    result: parsed.result,
                    evidence: `Tool ${capabilityId} executed successfully via MCP.`
                  });
                }
              }
            }
          }
        } catch (e) {
          // Waiting for more chunks to form complete JSON lines
        }
      });

      child.stderr.on('data', (chunk) => {
        errorData += chunk.toString();
      });

      child.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`MCP process error: ${err.message}`));
        }
      });

      child.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          if (code !== 0 && code !== null) {
            reject(new Error(`MCP process exited with code ${code}. Stderr: ${errorData}`));
          } else {
            reject(new Error('MCP process closed without sending a valid JSON-RPC response.'));
          }
        }
      });

      // Send the request over stdio
      child.stdin.write(JSON.stringify(requestPayload) + '\n');

      const timeoutMs = context.timeout || 30000;
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          child.kill();
          reject(new Error('MCP execution timed out.'));
        }
      }, timeoutMs);
    });
  }
}

module.exports = McpTransportStrategy;
