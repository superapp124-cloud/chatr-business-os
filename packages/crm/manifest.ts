export const CRMManifest = {
  capability: "crm_sales",
  semantic_version: "1.0.0",
  dependencies: ["core_auth", "core_activity"],
  resource_usage: {
    cpu: "2 cores",
    ram: "8GB",
    models: ["llama3.1:8b", "qwen2.5:14b", "nomic-embed-text"]
  },
  primitives: {
    objects: "crm_objects.json",
    state_machines: "crm_state_machines.json",
    policies: "crm_policies.json",
    execution_graphs: "crm_execution_graphs.json",
    intents: "crm_intents.json",
    participants: "crm_participants.json",
    agents: "crm_agents.json",
    knowledge: "crm_knowledge.json",
    experience: "crm_experience.json",
    import_export: "crm_import_export.json"
  },
  rollback_plan: "Migrate all opportunities to CSV backup and unregister capability hooks."
};
