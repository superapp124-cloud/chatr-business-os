export const RecruitmentManifest = {
  capability: "hr_recruitment",
  semantic_version: "1.0.0",
  dependencies: ["core_auth", "core_activity"],
  resource_usage: {
    cpu: "2 cores",
    ram: "8GB",
    models: ["llama3.1:8b", "qwen2.5:14b", "nomic-embed-text"]
  },
  primitives: {
    objects: "rec_objects.json",
    state_machines: "rec_state_machines.json",
    policies: "rec_policies.json",
    execution_graphs: "rec_execution_graphs.json",
    intents: "rec_intents.json",
    participants: "rec_participants.json",
    agents: "rec_agents.json",
    knowledge: "rec_knowledge.json",
    experience: "rec_experience.json",
    import_export: "rec_import_export.json"
  },
  rollback_plan: "Migrate all active candidate profiles to CSV backup and unregister capability hooks."
};
