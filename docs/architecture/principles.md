# Design Principles

These are the immutable rules of the CHATR OS architecture. They form the Constitution of the platform. Every feature, engine, and pull request must be measured against these principles. If a feature violates a principle, the feature is redesigned—we do not create special cases.

## 1. Everything is Metadata
The system is entirely driven by the Enterprise Definition Language (EDL). Business OS, Studio, and the Runtime all consume the same metadata. Code is reserved for engines; business logic belongs in metadata.

## 2. Everything Emits Events
No object is mutated silently. The `Event Engine` is the source of truth for all state changes. If it isn't an event, it didn't happen.

## 3. Every Object is Time-Aware
Data is not 2D. The kernel understands *State-at-Time-T*. Current state is merely a projection of history. Future state (forecasts, planned budgets, upcoming roles) is stored alongside current state.

## 4. Everything is Explainable
When the AI makes a recommendation or answers a question, the response must have deterministic evidence. The Intelligence Engine cannot hallucinate facts; it can only reason over the determinism provided by the Kernel.

## 5. UI Never Owns Business Logic
React components (Business OS, Studio) are purely presentation layers. They render what the metadata dictates. If a rule requires code in a UI file, the metadata schema is incomplete.

## 6. AI Never Owns Truth
The Intelligence Engine (LLM) is an isolated reasoning layer. It does not store data, enforce policies, or evaluate permissions. It only asks the Kernel for truth, and generates explanations based on it.

## 7. Deterministic Before Probabilistic
A user asking "How many open positions do we have?" should trigger a deterministic graph query, not a probabilistic LLM token-generation task. The LLM is the last step in the pipeline.

## 8. Every Capability is Discoverable
If a user installs a capability from the Marketplace, it immediately plugs into the Semantic Engine and Knowledge Engine. The AI instantly understands how to interact with it without additional prompt engineering.

## 9. Human Override Always Exists
The platform is an autonomous assistant, not a black box dictator. Every automated workflow, decision, or AI action must be interceptable, auditable, and reversible by a human actor.

## 10. Offline-First Where Possible
Enterprise knowledge must remain accessible and robust. While the Intelligence Engine requires network access, the deterministic Core Reality (events, objects, workflows) should support resilient local execution boundaries.

## 11. Engine Independence
No engine may directly mutate another engine's state. Communication happens strictly through contracts and Events. Internal engine state is fully encapsulated.

## 12. The Golden Rule of CHATR OS
**The Kernel owns truth. The Runtime owns behavior. The Clients own experience. AI owns neither truth nor behavior—it enhances understanding and decision-making.**
