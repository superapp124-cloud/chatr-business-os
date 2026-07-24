import { CapabilityValidator } from '../validation/CapabilityValidator';
import { CapabilityCompiler } from '../validation/CapabilityCompiler';
import { CapabilityRegistry } from './CapabilityRegistry';
import { EDLLivingObject } from '../contracts/edl/types';

/**
 * Pack Loader
 * Orchestrates the loading of a capability pack from raw JSON into the Runtime.
 * Pipeline: Load -> Validate (Structural & Semantic) -> Compile -> Registry Install
 */
export class PackLoader {
  constructor(
    private registry: CapabilityRegistry,
    private validator: CapabilityValidator = new CapabilityValidator(),
    private compiler: CapabilityCompiler = new CapabilityCompiler()
  ) {}

  /**
   * Loads a pack from raw JSON objects.
   * In a real environment, this might fetch from a URL or read from disk.
   */
  async loadFromJSON(rawManifest: any, rawObjects: any[]) {
    console.log(`[PackLoader] Loading pack: ${rawManifest.name}`);

    // Phase 1: Structural Validation
    const structuralRes = this.validator.validateStructural(rawManifest, rawObjects);
    if (!structuralRes.valid) {
      throw new Error(`Structural Validation Failed: ${structuralRes.errors.join(', ')}`);
    }

    // Since it's structurally valid, we can safely cast to EDLLivingObject for semantics
    const typedObjects = rawObjects as EDLLivingObject[];

    // Phase 2: Semantic Validation
    const semanticRes = this.validator.validateSemantic(rawManifest, typedObjects);
    if (!semanticRes.valid) {
      throw new Error(`Semantic Validation Failed: ${semanticRes.errors.join(', ')}`);
    }

    // Phase 3: Compilation (Normalize, ID, Hash)
    const { manifest, objects } = this.compiler.compile(rawManifest, typedObjects);

    // Phase 4: Registry Install
    this.registry.install(manifest, objects);
    
    console.log(`[PackLoader] Successfully installed pack: ${manifest.name} (v${manifest.version})`);
  }
}
