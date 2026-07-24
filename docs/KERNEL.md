# CHATR Kernel 1.0

This document defines the frozen architecture, interaction model, and performance budgets for CHATR Kernel 1.0. All future capability modules (Meetings, Healthcare, Wallet, Documents, etc.) must be built on top of this kernel, consuming its events and abiding by its laws.

## The Kernel Pipeline
The runtime architecture is a unidirectional event pipeline. Nothing modifies the kernel directly; capability modules hook into these stages.

`Input → Observation → Understanding → Context Runtime → Policy Engine → Entity Graph → Action Surface → Execution → Intent Journal → Learning`

---

## The 6 Kernel Laws

**Law 1 — Local First**
Every stage attempts local execution before any remote service.

**Law 2 — Never Invent Reality**
If something cannot be verified (`resolved = false`), do not fabricate it. 

**Law 3 — Context is Inferred, Never Assumed**
Context continuity requires high confidence arbitration. Otherwise, ask. Never guess silently.

**Law 4 — One Interaction Grammar**
Every future feature must implement the identical UX pipeline without exception. No standalone dialogs or unique chat interfaces.

**Law 5 — Execution is Immutable**
Execution cannot change history. Only `Undo` creates a new journal entry to revert state. Previous records are never mutated.

**Law 6 — Learning Never Blocks**
Learning always happens asynchronously, downstream of the Intent Journal. Execution must never wait for learning.

---

## Kernel Performance Budgets

These are strict service-level objectives to preserve the illusion of instantaneous, ambient thought.

| Stage | Target Budget |
| :--- | :--- |
| **Observation** | `<5 ms` |
| **Understanding** | `<30 ms` |
| **Context Arbitration** | `<10 ms` |
| **Entity Graph** | `<20 ms` |
| **Understanding Horizon** | `<80 ms` |
| **Action Surface (Local Path)** | `<300 ms` |
| **Complete Local Flow** | `<500 ms typical` |

---

## Kernel Events
Modules may subscribe to the following events emitted by the Kernel:
- `INPUT.RECEIVED`
- `OBSERVATION.CREATED`
- `UNDERSTANDING.CREATED`
- `CONTEXT.RESOLVED`
- `POLICY.VERIFIED`
- `ACTION.REVEALED`
- `ACTION.CONFIRMED`
- `ACTION.EXECUTED`
- `JOURNAL.APPENDED`
- `LEARNING.COMPLETE`

---

## Capability Governance

From Kernel 1.0 onward, no capability is allowed to invent its own UX or execution pipeline. Every new vertical domain must act as a Capability Module that hooks into the Kernel via Stable Extension Points.

### Stable Extension Points
Modules cannot mutate the kernel directly. They may only provide:
- **Observation providers**
- **Entity resolvers**
- **Policy providers**
- **Action executors**
- **Learning consumers**

### Capability Certification Checklist
Before a new module (e.g., Meetings, Tasks, Healthcare) is merged, it MUST pass the following certification invariant test:

| Requirement | Pass |
| :--- | :--- |
| Uses Observation layer | ✓ |
| Produces Semantic Entities | ✓ |
| Uses Context Runtime | ✓ |
| Respects Policy Engine | ✓ |
| Uses Universal Action Surface (No custom UI) | ✓ |
| Writes to Intent Journal upon execution | ✓ |
| Supports Undo (where applicable) | ✓ |
| Introduces NO new interaction patterns | ✓ |

### Capability Manifests
Each vertical module must declare its capabilities in a `manifest.json` file. It must describe exactly what it consumes, what it produces, and what permissions it requires.

```json
{
  "capability": "Meetings",
  "consumes": ["Observation", "Context", "Policy"],
  "produces": ["Meeting Entity", "Calendar Action"],
  "permissions": ["Calendar", "Contacts"],
  "journal_events": ["Meeting Created", "Meeting Updated", "Meeting Cancelled"]
}
```

4. **Bypass capability boundaries:** The runtime may know capabilities. Capabilities may never know each other. If a capability (e.g. Meeting) requires another (e.g. Reminder), it must be orchestrated by the Outcome Runtime, never by direct coupling.
5. **Update UI directly:** No capability may directly update the UI. Capabilities must only emit outcome events, and the UI only renders outcome state.
