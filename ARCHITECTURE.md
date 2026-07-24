# CHATR OS Architecture Contracts

This document defines the rigid architectural boundaries, state management rules, and event naming conventions required for all modules in the CHATR AI-Native Operating System.

## 1. OS Design Rules (Data Flow)

Every module **must** follow the same unidirectional data flow contract:

`UI Component` → `Custom Hook` → `Service Layer` → `Repository Layer` → `Supabase / Edge Function` → `EventBus` → `Telemetry`

**Strict Rule:** No UI component should call Supabase directly. All database interactions must be abstracted into a Service/Repository.

## 2. Standardized Folder Structure

Every major module or page subsystem must adhere to this folder structure to avoid one-off designs:

```text
ModuleName/
├── components/    # Presentational React components only (memoized)
├── hooks/         # Custom React hooks containing local state and logic
├── services/      # Business logic and external API communication
├── providers/     # React Context providers for shared state
├── types/         # TypeScript interfaces and types
├── utils/         # Helper functions
├── tests/         # Unit and integration tests
└── index.ts       # Public exports for the module
```

## 3. Event Naming Convention

All events published to the OS `EventBus` must follow a strict dot-notation domain pattern:

- **Chat Module:** `chat.message.sent`, `chat.message.received`, `chat.room.joined`
- **Workflow Engine:** `workflow.started`, `workflow.completed`, `workflow.failed`, `workflow.node_executed`
- **Kernel / OS:** `kernel.ready`, `kernel.shutdown`, `kernel.error`
- **Memory / AI:** `memory.updated`, `search.executed`, `ai.context_generated`
- **System:** `notification.created`, `sync.started`, `sync.completed`

## 4. State Management Ownership

State must not be duplicated across layers. Ownership is strictly defined:

- **Local UI State:** React (`useState`, `useReducer`) inside Hooks.
- **Shared Application State:** Global Store (Zustand) or Context API (`providers/`).
- **OS Events & Cross-Module Communication:** `EventBus` (Pub/Sub).
- **Server Data (Truth):** Supabase (accessed via Services).
- **AI Context & Memory:** `ContextEngine.ts` (retrieved on-the-fly, not permanently stored in UI state).

## 5. Observability & Telemetry

Every operation crossing a layer boundary must generate telemetry.
Trace pipeline: `User Prompt → Intent → Planner → Workflow → Edge Function → Database → LLM → Response`

Capture requirements for all major operations:
- `execution_time`
- `status` (success/failure)
- `retries`
- `tokens_used`
- `latency_ms`
- `error_context`

## 6. Performance Budgets

Regressions are measurable. The following budgets are enforced:
- **Initial Desktop Load:** < 2.0 seconds
- **Chat Render Frame:** < 16 ms (60 FPS)
- **Universal Search (DB):** < 300 ms (excluding LLM generation)
- **Workflow Event Propagation:** < 100 ms
- **EventBus Publish Sync:** < 10 ms
- **AI Context Retrieval:** < 150 ms

## 7. AI Memory Lifecycle

Semantic memory is not append-only. The engine must respect the full lifecycle to prevent hallucination and noise:
1. **Create:** Embed and insert new memory.
2. **Update:** Modify existing memory based on delta.
3. **Merge:** Combine related fragments into a cohesive concept.
4. **Archive:** Deprioritize unused memories out of the hot context window.
5. **Delete:** Permanently remove on user request.
6. **Re-embed:** Update vector representation when embedding models change.

## 8. Offline Engine (Synchronization)

Offline mode is a synchronization pipeline, not just caching.
Pipeline: `Action → Local Queue → Conflict Detection → Merge → Server Sync → Confirmation`
Every module must define behavior for:
- **Messages:** Queue locally.
- **Documents:** Read from cache.
- **Workflows:** Pause and resume.
- **AI:** Retry with exponential backoff.
- **Notifications:** Sync later.

## 9. Intent OS Execution Layer & Local-First Architecture (Kernel ABI v1.0)

CHATR is a Local-First Intent OS. The Cloud provides synchronization, but local execution is mandatory for core functionality (SQLite, Local Vector, Local AI, Browser Automation).

### The Runtime Framework & Manifests
The OS operates via a strict hierarchy:
`Capability` → `Runtime` → `Provider`

- **Capabilities** are declared via strict JSON Manifests (version, dependencies, events, permissions).
- **Runtimes** own execution domains and report their Health dynamically.
- **Providers** are replaceable implementations bound to capabilities via the `RuntimeManager`.

### Core Runtimes (ABI v1.0)
1. **Desktop Runtime**: filesystem, windows, clipboard, local OS search.
2. **Browser Runtime**: sessions, cookies, downloads, DOM execution.
3. **Intelligence Runtime**: OCR, Speech-to-text, Image understanding, Translation, Classification.
4. **Memory Runtime**: Vector embeddings, local semantic search.
5. **Knowledge Runtime**: Knowledge graph, entity linking (People → Companies → Files → Events).
6. **Communication Runtime**: email, call, sms, meetings.
7. **Workflow Runtime**: Orchestrates steps.
8. **Policy Runtime**: Enforces permissions, approvals, safety constraints before execution.
9. **Cloud Sync Runtime**: Background state syncing.
10. **Intent Runtime**: Tracks Intent Timeline, History, Replay, and Bookmarks (first-class OS component).
11. **Session Runtime**: Context preservation across launches/devices.

### Workspaces & The Unified IDE
The UI is no longer a collection of disjointed apps. It is a **Unified Workspace IDE**.
- **Shell**: The top-level React router.
- **WorkspaceManager**: Manages declarative Workspace Manifests (Personal, HR, Sales).
- **Layout**: 
  - *Left*: Workspaces Navigation.
  - *Center*: Active Context / Document / Command Palette.
  - *Right*: AI Copilot / Memory.

### System Indexer
A background daemon combining native OS indexing (e.g., Windows Search) with a CHATR-native enriched index (embeddings, custom tags, workflow metadata) for instant semantic resolution.

### Repository Layer
The UI must NEVER access raw data sources (SQLite, Mocks, or Supabase) directly.
All data access flows through Repositories, which compose multiple storage backends:
`UI` → `Repository` → `[Local Database, Filesystem, Cache, Vector Store]`

---
*These rules are mandatory. Code reviews must verify compliance against these contracts.*
