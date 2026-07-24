# CHATR Genesis Constitution v1.0 (Frozen)

> Everything is a Commitment.

## CHATR's Mission
CHATR exists to reduce the distance between human intention and trusted reality.
- **Purpose:** Reduce the distance between intention and trusted reality.
- **Method:** Understand conversations, create commitments, orchestrate execution, and verify reality.
- **Success:** People stop opening other apps because CHATR already completed the work.

## Product Vision
CHATR is an Outcome Operating System built around commitments. It understands human conversations, transforms intentions into trusted commitments, orchestrates execution through capabilities and providers, verifies reality, and continuously learns—all while remaining invisible to the user. The goal is not to help people use software. The goal is to quietly complete work so people no longer need to think about software at all.

> **Law Zero: No architectural changes without production evidence.**
> From this point onward, the architecture must earn changes through real usage. Every future PR must answer:
> 1. Does it help one of the Genesis Capabilities complete real work?
> 2. Does it reduce Intent Completion Time?
> 3. Did a real user (or your own dogfooding) reveal the need for it?
> If the answer to any of those is "no," it can wait.

## The Six Immutable Primitives
Everything in CHATR reduces to these six concepts. Nothing else is fundamental.
1. **Intent:** What the user wants.
2. **Commitment:** The promise that must become reality.
3. **Capability:** The mechanism that performs work.
4. **Trust:** The authority and boundaries governing execution.
5. **Reality:** Verification that work actually happened.
6. **Learning:** The permanent improvement of future decisions.

## Five Product Principles (Never Change)
1. **Conversation is the interface:** Not forms. Not menus. Not dashboards.
2. **Suggestions before automation:** Trust is earned. Never surprise users.
3. **One Tap Rule:** The most common action should require one confirmation.
4. **Progressive Intelligence:** The system becomes more certain over time. Never suddenly "acts smart."
5. **Silent Intelligence:** No AI branding. No typing animations. No "thinking..." Only completed work.

## Six Engineering Non-Negotiables
1. **Privacy:** User data belongs to the user.
2. **Local First:** Everything possible runs locally.
3. **Offline First:** The product should degrade gracefully without internet.
4. **Deterministic First:** Rules before AI. Resolvers before LLM. LLM only when necessary.
5. **Observable:** Every commitment can be replayed.
6. **Reversible:** Every destructive action supports undo whenever feasible.

## The Eight Kernel Laws
1. **Kernel owns orchestration.**
2. **Capabilities own execution.**
3. **Providers own integrations.**
4. **Reality decides success.**
5. **Learning is local-first.**
6. **UI never owns logic.**
7. **Every feature must reduce Intent Completion Time.**
8. **Commitments are immutable.** State changes create events, never overwrite history.

## The Kernel Pipeline
`Human` → `Conversation` → `Understanding Service` → `Intent` → `Commitment Planner` → `Commitment` → `Commitment Runtime` → `Capability` → `Provider` → `Reality Engine` → `Learning Engine`

### The Commitment Planner
The Planner is not an AI. It is a deterministic routing service that decides:
- Which capability? Which provider? Is confirmation required? Can this execute offline?

### The Understanding Service
Understanding is an OS service, not an LLM. It must be layered to preserve privacy and speed:
`Conversation` → `Deterministic Rules` → `Knowledge Resolver` → `Time Resolver` → `Contact Resolver` → `Semantic Resolver` → `AI Provider (only if required)` → `Intent`

## Universal Commitment Lifecycle
No exceptions.
`Intent Detected` → `Commitment Created` → `Validated` → `Suggested` → `Confirmed` → `Executing` → `Waiting` → `Reality Verified` → `Completed` → `Learned` → `Archived`

## The Frozen Interfaces
These top-level contracts will not change.
- `EventBus`
- `UnderstandingService`
- `CommitmentPlanner`
- `CommitmentRuntime`
- `Capability`
- `Provider`
- `RealityEngine`
- `LearningEngine`

## The Capability SDK
Capabilities only expose the following interface. They never touch external services directly; they use `Providers`.
- `manifest`
- `validator`
- `planner` (optional)
- `executor`
- `verifier`
- `undo`
- `tests`

---

## The Genesis Roadmap

We measure success strictly through these seven metrics:
1. **Commitment Fulfillment Rate (CFR):** Commitments Successfully Verified / Commitments Created. The signature KPI of CHATR.
2. **Intent Completion Time:** How quickly users get from intention to completion.
3. **Suggestion Acceptance Rate:** Indicates trust in the system.
4. **Reality Verification Rate:** Confirms work actually happened.
5. **External Apps Avoided:** Shows whether CHATR is replacing other tools.
6. **Commitments Completed:** Reflects actual value delivered.
7. **Daily Active Commitments:** Measures ongoing engagement.

### Phase 1: Foundation ✅
Kernel, SDK, Runtime, Providers established. Done.

### Phase 2: Genesis Capabilities (Current)
Build the 15 Genesis Capabilities. Certify every one. Dogfood.
**Personal Productivity:** Reminder, Task, Note, Checklist, Follow-up
**Communication:** Call, Email, Contact
**Collaboration:** Meeting, Calendar Event, Document
**Business:** Candidate Interview, Expense
**Travel:** Flight Booking, Hotel Booking

*Phase 2 is ONLY complete when:*
- All 15 Genesis Capabilities are certified.
- CFR > 90%.
- Intent Completion Time < 30 seconds.
- Suggestion Acceptance Rate > 70%.
- Reality Verification Rate > 95%.
- Founder uses CHATR exclusively for three consecutive workdays.
- At least 80% of daily commitments are completed inside CHATR without opening another app.

### Phase 3: Founder's Gate
Three days of living entirely inside CHATR.

### Phase 4: Private Beta
Deploy to 30–50 users. Observe the Seven Metrics. No architecture work.

### Phase 5: General Availability
Launch only after the metrics prove adoption.

### Phase 6: Capability Ecosystem
Expand to 100+ capabilities based on real-world constraints (Enterprise, Third-party, Community).

---

## Capability Definition of Done
A Genesis Capability is not complete until it satisfies all of these:
**Understanding:** Detect intent, Extract entities, Build commitment
**Experience:** Suggest naturally, Editable preview, One-tap confirm, Undo
**Runtime:** Executes through Commitment Runtime, Uses Provider interface only, No UI logic, No direct database access
**Reality:** Verifies completion, Handles failures, Supports retries
**Observability:** Telemetry, Journal, Trace, Metrics
**Quality:** Unit tests, Integration tests, Dogfooded
