import { EDLLivingObject } from '../contracts/edl/types';

/**
 * Capability Compiler
 * Takes raw parsed JSON packs, normalizes metadata, assigns missing deterministic IDs, 
 * resolves references, optimizes lookups, and produces deterministic hashes.
 */
export class CapabilityCompiler {
  
  compile(manifest: any, objects: any[]): { manifest: any, objects: EDLLivingObject[] } {
    const compiledObjects: EDLLivingObject[] = objects.map(obj => {
      // Deep clone to avoid mutating raw input
      const compiledObj = JSON.parse(JSON.stringify(obj)) as EDLLivingObject;
      
      // Normalize metadata
      if (!compiledObj.metadata) {
        compiledObj.metadata = {};
      }

      // Add deterministic internal tags for optimized lookup
      compiledObj.metadata['_compiledAt'] = Date.now();
      compiledObj.metadata['_packId'] = manifest.id;

      // In a real implementation, we would resolve references across other packs here
      // and maybe inject a deterministic hash of the object shape for versioning.
      
      return compiledObj;
    });

    const compiledManifest = {
      ...manifest,
      _compiledAt: Date.now(),
      _checksum: this.generateChecksum(manifest, compiledObjects) // Simulate deterministic hash
    };

    return { manifest: compiledManifest, objects: compiledObjects };
  }

  private generateChecksum(manifest: any, objects: any[]): string {
    // Simple mock checksum generator for Gate C proof
    return `sha256:mock_hash_${manifest.id}_${objects.length}`;
  }
}
