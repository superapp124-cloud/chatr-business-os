'use strict';

/**
 * CHATR Kernel SDK — Package API
 * 
 * Provides the public, stable contract for authoring Intent Intelligence Packages.
 * A Package is an installable module contributing up to 8 distinct components:
 * 1. Manifest
 * 2. Ontology
 * 3. Intent Models
 * 4. Goal Templates
 * 5. Workflow Templates
 * 6. Policies
 * 7. Knowledge (Reference Data)
 * 8. Services (Optional reactive logic)
 */

class IntentIntelligencePackage {
  constructor(manifest) {
    if (!manifest || !manifest.id || !manifest.version) {
      throw new Error('Package must have a valid manifest with id and version');
    }
    this.manifest = manifest;
    this.ontology = [];
    this.intentModels = [];
    this.goals = [];
    this.workflows = [];
    this.policies = [];
    this.knowledge = [];
    this.services = [];
  }

  /**
   * Called by the Package Compiler during installation.
   * Packages should override this to perform setup.
   */
  async initialize() {
    // Default implementation does nothing
  }

  registerOntology(schema) {
    this.ontology.push(schema);
  }

  registerIntentModel(model) {
    this.intentModels.push(model);
  }

  registerGoalTemplate(goal) {
    this.goals.push(goal);
  }

  registerWorkflowTemplate(workflow) {
    this.workflows.push(workflow);
  }

  registerPolicy(policy) {
    this.policies.push(policy);
  }

  registerKnowledge(data) {
    this.knowledge.push(data);
  }

  registerService(service) {
    this.services.push(service);
  }

  /**
   * Called by the Kernel on system shutdown.
   */
  async shutdown() {
    // Default implementation does nothing
  }
}

module.exports = { IntentIntelligencePackage };
