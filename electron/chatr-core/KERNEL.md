# KERNEL.md — The CHATR Kernel Contract

> **This document is law. No code may be merged that violates it.**
> Version: 2.0.0 | Codename: Intent OS | Effective from Phase 5.1

---

## 0. CHATR Intent OS — The 10 Principles

> These are architectural invariants. Every contributor, every PR, every new capability must be measured against them.

```
1.  Users express outcomes, not commands.
2.  The Planner never knows providers.
3.  The Workflow Engine never knows websites.
4.  Executors never know user intent.
5.  Connectors are declarative, not procedural.
6.  Every execution improves the World Model.
7.  Context is resolved before planning.
8.  Unknown websites are learnable.
9.  Execution is always explainable.
10. Every capability must be independently replaceable.
```

**Principle 2–4 in one sentence:** Each layer has exactly one responsibility and communicates downward only through its defined interface.

---

## 0.1 The Execution Abstraction Stack

```
User Intent Text
      │
  [ Planner ]                  ← extracts: intent type + explicit constraints only
      │                           knows NOTHING about providers or websites
      │
  [ Intent Intelligence Engine ]
      │   5 resolvers: Entity / Context / Constraint / Preference / Risk
      │   emits: needs_clarification OR resolved constraints
      │
  [ Trust Engine ]             ← evaluates: safe | confirm | restrict
      │
  [ Discovery Engine ]         ← geographic → mode → capability → rank
      │
  Capability                   e.g.  transport.book
      │
  Execution Strategy           e.g.  BrowserStrategy / APIStrategy / SimulationStrategy
      │
  Execution Adapter            e.g.  TransportAdapter (knows selector/form structure)
      │                              ONLY this layer changes when a provider gets an API
  Provider (declarative)       e.g.  IRCTC / ixigo / ConfirmTkt (config, no code)
      │
  [ World Model ]              ← updated after every execution (preferences, routes, habits)
```

**Zero Mock Data Law (Genesis Law #12 — elevated to Principle):**
The Kernel must never fabricate reality. Missing data is acceptable. Incorrect data is not.
No constraint may be invented to keep a workflow moving.

---

## 1. What the Kernel Is

The CHATR Kernel is the runtime that sits between all user-facing interfaces and all intelligence providers. It is not a chat API. It is not an AI wrapper. It is the foundational operating layer of CHATR — equivalent in purpose to what the Linux Kernel is to processes.

The Kernel's sole responsibility is to:
- Boot and register modules
- Route requests through the standard lifecycle
- Orchestrate execution via the Orchestrator
- Publish events on the Event Bus
- Enforce trust boundaries
- Recover from failure

---

## 2. Kernel Responsibilities

| Responsibility | Owner |
|----------------|-------|
| Module registration and validation | Kernel / Feature Registry |
| Provider registration and resolution | Kernel / Provider Registry |
| Request lifecycle enforcement | Kernel Orchestrator |
| Event publication | Event Bus |
| Context resolution | Context Resolver |
| Streaming normalization | SSE Transport |
| Health and metrics exposure | Health Module |
| Recovery on restart | Recovery Manager |

---

## 3. What Modules MAY Do

- Register themselves via `featureRegistry.register(manifest, handler)`
- Subscribe to Kernel Events via `bus.subscribe(CORE.*, handler)`
- Publish Kernel Events via `bus.publish(CORE.*, payload)`
- Call the Kernel Orchestrator to execute provider work
- Read from Context Resolver
- Write to Supabase for persistence

---

## 4. What Modules MUST NEVER Do

```
❌ A module MUST NOT directly instantiate a provider (new OllamaProvider())
❌ A module MUST NOT call another module's service directly
❌ A module MUST NOT expose raw provider responses to the UI
❌ A module MUST NOT bypass the Kernel Orchestrator lifecycle
❌ A module MUST NOT skip event publication for any lifecycle stage
❌ A module MUST NOT access another module's internal files
❌ A module MUST NOT modify another module's Supabase data
❌ A module MUST NOT disable or override the Judgment layer (future)
❌ A module MUST NOT make irreversible changes without Trust Level validation
```

**The Golden Rule: No module may directly call another module. Everything communicates through Kernel Events or Kernel Services.**

---

## 5. Core Product Principles

> **Progressive Understanding**
> Intelligence should reveal itself gradually, never block interaction, and never interrupt human flow. Users must never wait for an LLM to decide if a UI suggestion should exist.

> **Progressive Certainty**
> Intelligence doesn't suddenly become smart. It becomes more certain over the lifecycle of an observation.

> **UI Stability**
> The UI should never become more complex as the system becomes more intelligent. Never interrupt flow.

> **Stability Over Refactors**
> Never refactor stable infrastructure inside feature milestones. Wrap it instead.

> **Zero Mock Data (Genesis Law #12)**
> The Kernel must never fabricate reality. If knowledge is unavailable, the Kernel must expose uncertainty rather than invent certainty. Missing data is acceptable. Incorrect data is unacceptable. Every fact surfaced to the user must have an identifiable source and a verifiable provenance. Mock, placeholder, seeded, demo, or fallback data is prohibited in production. Development mocks are permitted only behind an explicit feature flag (`CHATR_DEV_MOCK_MODE=true`) and must never be bundled into production builds.

---

## 5. Event Rules

All events MUST use the constants defined in `events/events.cjs`. Raw string event names are forbidden.

Every request lifecycle MUST publish these events in order:
```
CORE.REQUEST_STARTED
CORE.CONTEXT_RESOLVING
CORE.CONTEXT_RESOLVED
CORE.PROVIDER_RESOLVED
CORE.PROVIDER_STARTED
CORE.STREAM_STARTED        (if streaming)
CORE.STREAM_DELTA          (per token, if streaming)
CORE.STREAM_COMPLETED      (if streaming)
CORE.PERSIST_STARTED
CORE.PERSIST_COMPLETED
CORE.REQUEST_COMPLETED
```

On failure, the terminal event MUST be:
```
CORE.REQUEST_FAILED   { requestId, error }
CORE.STREAM_FAILED    { requestId, error }
CORE.PERSIST_FAILED   { requestId, error }
```

### Intelligence Event Lifecycle
For modules operating in the Semantic/Understanding pipeline:
```
INTELLIGENCE.OBSERVATION.CREATED
INTELLIGENCE.CLASSIFICATION.CREATED
INTELLIGENCE.CONTEXT.RESOLVED
INTELLIGENCE.UNDERSTANDING.ENRICHED
INTELLIGENCE.SUGGESTION.CREATED
INTELLIGENCE.USER_ACCEPTED
INTELLIGENCE.EXECUTION_REQUESTED
INTELLIGENCE.COMMITMENT_CREATED
INTELLIGENCE.REALITY_VERIFIED
INTELLIGENCE.LEARNING_UPDATED
```

---

## 6. Lifecycle Stages

Every request passes through these stages in order. No stage may be skipped.

```
RECEIVE → NORMALIZE → RESOLVE_CONTEXT → RESOLVE_IDENTITY*
→ RESOLVE_TRUST* → RESOLVE_PROVIDER → EXECUTE
→ PERSIST → VERIFY* → PUBLISH_EVENTS → COMPLETE
```

`*` = reserved, enforced in future milestones.

If any stage fails, the lifecycle advances to `FAILED` immediately.

---

## 7. Module Registration Contract

Every module MUST provide a `module.json` manifest:

```json
{
  "name": "string (unique, lowercase)",
  "version": "semver string",
  "codename": "string",
  "description": "string",
  "dependencies": ["runtime", "events", ...],
  "status": "stable | beta | reserved | disabled"
}
```

A module with `status: "reserved"` is registered but never invoked.  
A module with `status: "disabled"` is not loaded.

### The ChatrModule Interface
Every module (except stable legacy modules like Conversation) SHOULD implement the standard `ChatrModule` lifecycle interface:
```javascript
class ChatrModule {
  observe(event) {}
  classify(observation) {}
  understand(classification) {}
  suggest(understanding) {}
  execute(action) {}
  verify(result) {}
  learn(feedback) {}
}
```

---

## 8. Provider Contract

Every provider MUST implement the full AIProvider interface:

```javascript
generate(messages, opts)   → Promise<string>
stream(messages, opts, onToken) → Promise<void>
cancel()                   → void
health()                   → Promise<ProviderHealth>
listModels()               → Promise<Model[]>
pullModel(name)            → Promise<void>
```

Providers are resolved exclusively through `providerRegistry.resolve()`.  
Direct instantiation is a contract violation.

---

## 9. UI Contracts

The UI MUST only communicate with the Kernel through the Conversation SDK:

```typescript
conversation.send(request)
conversation.stream(request, onEvent)
conversation.cancel()
conversation.health()
conversation.models()
```

The UI MUST never:
- Import from `electron/chatr-core/` directly
- Call Ollama APIs directly
- Handle raw SSE events (only normalized `conversation.*` events)
- Build context (context is backend-owned)

---

## 10. Versioning

```
Genesis  → Kernel 1.0 — Conversation Module (Current)
Core     → Kernel 1.x — Intent + Memory Modules
Judgment → Kernel 2.x — Judgment + Capabilities Modules
Reality  → Kernel 3.x — Reality + Learning Modules
```

Kernel minor versions are backward compatible.  
Major versions may require module manifest updates.  
No module may hardcode the Kernel version.

---

## 11. Recovery Rules

On kernel restart, the Recovery Manager MUST:
1. Check for interrupted requests in a durable recovery store
2. Attempt to resume streaming responses that were interrupted
3. Mark unrecoverable requests as `FAILED` in Supabase
4. Publish `CORE.RECOVERY_COMPLETED` before accepting new requests

Recovery is reserved in Milestone 1 and activated in Milestone 2.

---

## 12. Metrics Obligations

Every module that executes requests MUST contribute to:
- `totalRequests` counter
- `totalLatencyMs` accumulator
- Per-stage timing via Kernel Clock marks

The `/conversation/metrics` endpoint is a production-grade diagnostic tool, not a developer toy.

---

## 13. Enforcement

CI/CD pipeline MUST reject PRs that:
- Add a direct provider instantiation outside `providers/`
- Add a raw string event name (not from `events.cjs`)
- Add a module without a `module.json` manifest
- Remove a lifecycle event publication from the Orchestrator
- Add an endpoint that bypasses the middleware stack

---

*This contract is version-controlled. Any amendment requires explicit CTO approval and a KERNEL.md version bump.*

4. **Bypass capability boundaries:** The runtime may know capabilities. Capabilities may never know each other. If a capability (e.g. Meeting) requires another (e.g. Reminder), it must be orchestrated by the Outcome Runtime, never by direct coupling.
5. **Update UI directly:** No capability may directly update the UI. Capabilities must only emit outcome events, and the UI only renders outcome state.
