import { ICapabilityPackage } from '../types.js';

export class CapabilityValidator {
  
  static validate(pkg: ICapabilityPackage): void {
    if (!pkg.manifest) {
      throw new Error('Capability package missing manifest.');
    }
    
    const { manifest, workflows } = pkg;
    
    // 1. Schema Validation
    if (!manifest.id || typeof manifest.id !== 'string') throw new Error(`Invalid or missing ID in capability manifest.`);
    if (!manifest.name) throw new Error(`Capability ${manifest.id} missing name.`);
    if (!manifest.version) throw new Error(`Capability ${manifest.id} missing version.`);
    
    // 2. ABI Validation
    // For V1.0, we just enforce the fields are arrays.
    if (!Array.isArray(manifest.verbs)) throw new Error(`Capability ${manifest.id} verbs must be an array.`);
    if (!Array.isArray(manifest.nouns)) throw new Error(`Capability ${manifest.id} nouns must be an array.`);
    
    // 3. Workflow Validation
    if (workflows) {
      const workflowIds = new Set<string>();
      for (const wf of workflows) {
        if (!wf.id) throw new Error(`Capability ${manifest.id} contains workflow without ID.`);
        if (workflowIds.has(wf.id)) {
          throw new Error(`Capability ${manifest.id} contains duplicate workflow ID: ${wf.id}`);
        }
        workflowIds.add(wf.id);
        
        if (!wf.plan || !Array.isArray(wf.plan.steps)) {
          throw new Error(`Workflow ${wf.id} in Capability ${manifest.id} missing steps array in execution plan.`);
        }
      }
    }
    
    console.log(`[CapabilityValidator] Successfully validated capability package: ${manifest.id} v${manifest.version}`);
  }
}
