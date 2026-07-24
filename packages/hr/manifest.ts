export const HRManifest = {
  capability: "core_hr",
  semantic_version: "1.0.0",
  dependencies: ["core_auth", "core_activity"],
  resource_usage: {
    cpu: "2 cores",
    ram: "8GB",
    models: ["llama3.1:8b", "qwen2.5:14b", "nomic-embed-text"]
  },
  primitives: {
    objects: "hr_objects.json",
    state_machines: "hr_state_machines.json",
    policies: "hr_policies.json",
    execution_graphs: "hr_execution_graphs.json",
    intents: "hr_intents.json",
    participants: "hr_participants.json",
    agents: "hr_agents.json",
    knowledge: "hr_knowledge.json",
    experience: "hr_experience.json",
    import_export: "hr_import_export.json"
  },
  rollback_plan: "Migrate all employee data to CSV backup and unregister capability hooks."
};
