import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ICapabilityManifest } from '../types.js';
import { CapabilityRuntime } from './CapabilityRuntime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SystemCapabilityLoader {
  /**
   * Recursively scans for 'manifest.ts' or 'manifest.js' files and loads them.
   * This simulates an enterprise discovery service (Local -> Marketplace -> Partner).
   */
  async discoverAndLoad() {
    console.log('[CapabilityLoader] Starting capability discovery...');
    const capabilitiesDir = path.join(__dirname, '../capabilities');
    
    if (!fs.existsSync(capabilitiesDir)) {
      console.warn(`[CapabilityLoader] Capabilities directory not found: ${capabilitiesDir}`);
      return;
    }

    const manifests = this.findManifests(capabilitiesDir);
    
    for (const manifestPath of manifests) {
      try {
        // Dynamically import the manifest
        const module = await import(`file://${manifestPath}`);
        const manifest: ICapabilityManifest = module.default || module.manifest;
        
        // Find workflows
        const capabilityDir = path.dirname(manifestPath);
        const workflowsDir = path.join(capabilityDir, 'workflows');
        const workflows: any[] = [];
        
        if (fs.existsSync(workflowsDir)) {
          const workflowFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.workflow.ts') || f.endsWith('.workflow.js'));
          for (const wfFile of workflowFiles) {
            const wfModule = await import(`file://${path.join(workflowsDir, wfFile)}`);
            workflows.push(wfModule.default || wfModule.workflow);
          }
        }
        
        const pkg = { manifest, workflows };
        
        try {
          CapabilityRuntime.loadPackage(pkg);
        } catch (validationErr: any) {
          console.error(`[CapabilityLoader] Validation failed for package at ${manifestPath}: ${validationErr.message}`);
        }
      } catch (err) {
        console.error(`[CapabilityLoader] Failed to load manifest at ${manifestPath}`, err);
      }
    }
    
    console.log(`[CapabilityLoader] Discovery complete. Loaded ${CapabilityRuntime.getAll().length} capabilities.`);
  }

  private findManifests(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
      const filePath = path.resolve(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat && stat.isDirectory()) {
        results = results.concat(this.findManifests(filePath));
      } else if (file === 'manifest.ts' || file === 'manifest.js') {
        results.push(filePath);
      }
    }
    return results;
  }
}

export const CapabilityLoader = new SystemCapabilityLoader();
