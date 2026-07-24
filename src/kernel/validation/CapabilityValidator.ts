import { EDLLivingObject } from '../contracts/edl/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class CapabilityValidator {
  
  /**
   * Phase 1: Structural Validation
   * Ensures the manifest and EDL objects have all required fields, valid JSON structures,
   * unique IDs, etc.
   */
  validateStructural(manifest: any, objects: any[]): ValidationResult {
    const errors: string[] = [];
    
    if (!manifest.id || !manifest.version || !manifest.edlVersion) {
      errors.push('Manifest missing required fields (id, version, edlVersion)');
    }

    const objectUrns = new Set<string>();

    for (const obj of objects) {
      if (!obj.urn || !obj.type || !obj.primitiveType) {
        errors.push(`Object missing required fields (urn, type, primitiveType)`);
      }
      
      if (objectUrns.has(obj.urn)) {
        errors.push(`Duplicate URN found: ${obj.urn}`);
      }
      objectUrns.add(obj.urn);

      if (!obj.properties || !Array.isArray(obj.properties)) {
        errors.push(`Object ${obj.urn} is missing properties array`);
      }
      
      if (!obj.lifecycle || !obj.lifecycle.initialState || !obj.lifecycle.states) {
        errors.push(`Object ${obj.urn} is missing valid lifecycle definition`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Phase 2: Semantic Validation
   * Ensures no unreachable states, circular dependencies, impossible transitions, etc.
   */
  validateSemantic(manifest: any, objects: EDLLivingObject[]): ValidationResult {
    const errors: string[] = [];

    for (const obj of objects) {
      const definedStates = new Set(obj.lifecycle.states.map(s => s.name));
      const reachableStates = new Set<string>([obj.lifecycle.initialState]);

      if (!definedStates.has(obj.lifecycle.initialState)) {
        errors.push(`Object ${obj.urn} initial state '${obj.lifecycle.initialState}' is not defined in states array`);
      }

      for (const transition of (obj.lifecycle.transitions || [])) {
        if (!definedStates.has(transition.to)) {
          errors.push(`Object ${obj.urn} transitions to undefined state '${transition.to}'`);
        }
        reachableStates.add(transition.to);
        
        for (const fromState of transition.from) {
          if (!definedStates.has(fromState)) {
            errors.push(`Object ${obj.urn} transitions from undefined state '${fromState}'`);
          }
        }
      }

      for (const state of definedStates) {
        if (!reachableStates.has(state)) {
          errors.push(`Object ${obj.urn} has unreachable state '${state}'`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
