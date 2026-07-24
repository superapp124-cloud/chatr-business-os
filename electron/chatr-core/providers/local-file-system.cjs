'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalFileSystemProvider {
  constructor() {
    this.name = 'LocalFileSystemProvider';
  }

  async execute(capabilityId, parameters, context) {
    if (capabilityId === 'System.Persist') {
      const { data_blob, destination } = parameters;
      const workspacePath = path.join(os.homedir(), 'Documents', 'CHATR Workspace');
      
      if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
      }

      const targetPath = destination ? path.join(workspacePath, destination) : path.join(workspacePath, `data_${Date.now()}.bin`);
      fs.writeFileSync(targetPath, data_blob);

      return {
        success: true,
        filePath: targetPath
      };
    }
    
    if (capabilityId === 'Knowledge.Retrieve') {
      // Stub for raw file retrieve
      return { success: true, content: 'raw_file_content_stub' };
    }

    throw new Error(`Unsupported capability: ${capabilityId}`);
  }
}

module.exports = { LocalFileSystemProvider };
