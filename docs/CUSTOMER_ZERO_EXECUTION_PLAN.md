# CHATR Customer Zero Execution Plan

## Purpose

CHATR should become the first production customer of the CHATR Conversation Platform. Mobile, Desktop, Business Workspace, Enterprise Workspace, and future developer apps should consume the same internal platform APIs instead of each surface owning separate implementations for messaging, calling, automation, AI, notifications, and workspace state.

The goal is not a rewrite. The goal is a staged migration that preserves working product behavior while moving existing code behind stable platform contracts.

## Blueprint Document Set

Use three documents as the durable engineering blueprint:

- `docs/CHATR_PLATFORM_VISION.md`: product vision and long-term platform direction.
- `docs/PLATFORM_ARCHITECTURE.md`: services, APIs, event model, plugin model, AI tool registry, observability, security, and Platform Console.
- `docs/PLATFORM_EXECUTION_PLAYBOOK.md`: migration order, governance, coding standards, testing, versioning, deprecation, release process, and Customer Zero metrics.

This document remains the Customer Zero migration plan.

## Current Alignment

The codebase already contains several strong pieces of the target platform.

### Conversation and messaging foundation

- `conversations`, `conversation_participants`, and `messages` already exist in Supabase.
- `src/hooks/useChatConversations.tsx`, `src/hooks/useReliableMessages.tsx`, `src/hooks/useMessageSync.tsx`, and related hooks already implement important messaging behavior.
- `src/pages/Chat.tsx` and `src/pages/desktop/DesktopChat.tsx` already prove that mobile-style chat and desktop chat can consume the same backend data.

These should be wrapped into a `Conversation API` and `Messaging API`, not duplicated.

### Calling foundation

- `src/packages/communication-engine` is the closest existing implementation of a reusable calling layer.
- `CommunicationSession`, `GroupCallManager`, signaling adapters, WebRTC adapters, and device adapters already form a platform-shaped boundary.
- `src/contexts/CallContext.tsx` already bridges app state to the communication engine.

This should become the base of the `Calling API`.

### Event and orchestration foundation

- `supabase/migrations/20260630000000_orchestration_event_bus.sql` introduced `communication_events` and `mobile_action_queue`.
- `supabase/functions/orchestration-event-router/index.ts` already demonstrates message -> intent -> workflow -> action behavior.
- `src/services/orchestrationService.ts` gives the frontend a thin client for emitting orchestration events.

This is the right seed, but it is currently recruitment-specific and should be generalized.

### Intelligence and knowledge foundation

- `src/services/intelligence/schema.ts` defines a rich communication event, relationship, threat, AI, attention, and timeline model.
- `src/services/intelligence/engine.ts` already implements a pipeline for ingestion, classification, scoring, action generation, timeline updates, and notification decisions.
- `src/services/intelligence/eventBus.ts` already has a typed event bus and dead-letter behavior.

This should become part of the platform knowledge layer rather than staying separate from the Supabase event bus.

### AI and agent foundation

- `src/services/chatrBrain` contains routing, memory, actions, agent communication, and domain agents.
- `src/lib/ai` contains execution plans, a communication agent, context graph behavior, and model routing.

These overlap. They should be consolidated into one `AI Orchestrator` and `Agent Manager`.

### Business and automation foundation

- `supabase/functions/business-workflow-engine` and related functions show early workflow automation.
- `src/pages/desktop/RecruiterWorkspace.tsx` already demonstrates a Customer Zero use case where events update a live workspace pipeline.
- Existing edge functions for notifications, AI, search, calling, and business workflows can become platform services instead of page-specific utilities.

## Main Gaps

### UI still talks directly to Supabase too often

There are hundreds of direct `supabase.from`, `supabase.rpc`, and `supabase.functions.invoke` calls inside pages, components, hooks, and contexts. This makes each surface an app-specific integration instead of a platform client.

Examples:

- Chat pages and hooks directly query `conversations`, `conversation_participants`, and `messages`.
- Calling contexts and screens directly update `calls` and `session_rooms`.
- Business and workspace components directly invoke backend functions.

Target rule: UI may call platform APIs, hooks, and SDK clients. UI should not own persistence or orchestration logic.

### Event buses are fragmented

Current event systems include:

- `communication_events` in Supabase.
- `src/services/intelligence/eventBus.ts`.
- `src/lib/events/EventBus.ts`.
- `src/packages/communication-engine/core/EventBus.ts`.

These should be adapted behind one platform event contract.

### Calling has parallel stacks

The app still has legacy/direct call flows alongside the communication engine. Desktop, mobile, and global call listeners should all consume one `Calling API` contract, even if the first implementation delegates to existing modules.

### Workflow logic is too use-case specific

`orchestration-event-router` currently handles recruitment-specific behavior such as positive candidate replies and interview scheduling. That behavior is valuable, but it belongs in workflow rules or agents, not hardcoded inside the generic event router.

### AI systems overlap

`chatrBrain`, `src/lib/ai`, and `src/services/intelligence` each own part of routing, context, execution, memory, or decisioning. The platform needs one composition model:

- Knowledge layer ingests and indexes events.
- AI Orchestrator decides what should happen.
- Agent Manager selects and runs reusable agents.
- Workflow Engine executes durable actions and approvals.

## Target Internal Platform Shape

Create a platform boundary under `src/platform` and migrate existing code into adapters gradually.

Suggested structure:

```text
src/platform/
  apis/
    conversation/
    messaging/
    calling/
    notification/
    automation/
    identity/
    storage/
    browser/
    calendar/
    search/
    analytics/
  events/
    PlatformEventBus.ts
    eventTypes.ts
  workflows/
    WorkflowEngine.ts
    rules.ts
  agents/
    AgentManager.ts
    permissions.ts
  knowledge/
    ConversationTimeline.ts
    RelationshipGraph.ts
  adapters/
    supabase/
    communication-engine/
    chatr-brain/
    legacy/
```

This folder should initially wrap existing modules. It should not start as a rewrite.

## Canonical Event Contract

All platform services should publish and consume a common event shape.

```ts
export interface PlatformEvent<TPayload = unknown> {
  id: string;
  type: string;
  version: number;
  timestamp: string;
  workspaceId?: string;
  organizationId?: string;
  actorId?: string;
  actorType?: 'user' | 'agent' | 'system' | 'contact';
  conversationId?: string;
  entityId?: string;
  entityType?: string;
  source: 'mobile' | 'desktop' | 'business' | 'enterprise' | 'edge' | 'system';
  correlationId?: string;
  payload: TPayload;
}
```

Existing `communication_events` can be evolved or wrapped to support this shape. Avoid destructive schema changes while the app is live.

## Platform API Contracts

### Conversation API

Owns the canonical conversation object.

Responsibilities:

- Create and resolve conversations.
- List conversations by workspace, participant, or account.
- Return the unified timeline of messages, calls, tasks, notes, summaries, and workflow events.
- Hide table-level details from UI.

Initial adapters:

- Existing Supabase `conversations`.
- Existing Supabase `conversation_participants`.
- Existing Supabase `messages`.
- Existing call history tables.

### Messaging API

Owns message sending, receiving, delivery state, typing, reactions, attachments, and message events.

Initial adapters:

- `useReliableMessages.tsx` behavior.
- Existing `messages` table.
- Existing realtime subscriptions.
- Existing notification senders.

### Calling API

Owns call lifecycle, signaling, media session state, room membership, call outcomes, and call events.

Initial adapters:

- `src/packages/communication-engine`.
- Existing `calls` table.
- Existing `session_rooms` table.
- Existing simple WebRTC implementation only as a temporary legacy adapter.

### Workflow API

Owns durable rules, workflow runs, action queues, approval gates, retries, and status.

Initial adapters:

- `orchestration-event-router` as the event intake layer.
- `mobile_action_queue` as an initial action queue.
- Existing business workflow functions.

### AI Orchestrator and Agent Manager

Own decisioning, planning, agent selection, tool permissions, escalation, confidence thresholds, and memory.

Initial adapters:

- `src/services/chatrBrain` for routing, actions, memory, and domain agents.
- `src/lib/ai/ExecutionEngine.ts` for plans and approval gates.
- `src/services/intelligence` for communication intelligence and knowledge events.

### Notification API

Owns push, in-app notifications, desktop notifications, smart inbox decisions, quiet hours, escalation, and notification events.

Initial adapters:

- Existing notification edge functions.
- Existing smart notification and smart push functions.
- Existing notification tables.

## Migration Strategy

Use a strangler migration.

1. Add platform contracts and adapters.
2. Keep existing UI working through old paths.
3. Move one hook or screen at a time to the platform API.
4. Emit platform events in parallel with existing behavior.
5. Once a surface is fully migrated, remove the old direct integration for that surface.

No milestone should require the app to be broken while the migration is in progress.

## Milestones

### Phase 0 - Audit and guardrails

Status: in progress.

Deliverables:

- Capture the current alignment and gaps in this document.
- Identify reusable modules and avoid duplicate implementation.
- Add a rule for new work: no new direct Supabase persistence logic in pages or visual components.
- Prefer platform services, hooks, or adapters for all new messaging, calling, workflow, and notification work.

### Phase 1 - Platform contracts

Deliverables:

- Add `src/platform/types.ts`.
- Add `src/platform/events` with a shared event type and local bus facade.
- Add empty-but-typed API interfaces for conversation, messaging, calling, workflow, notification, and agents.
- Add Supabase adapter skeletons that call existing tables and functions.

Acceptance criteria:

- App behavior unchanged.
- Build passes.
- Existing hooks can import the new types without runtime changes.

### Phase 2 - Conversation and messaging API

Deliverables:

- Implement `Conversation API` over existing `conversations`, `conversation_participants`, and `messages`.
- Move `useChatConversations.tsx` behind the Conversation API.
- Move send/read/update message paths from `useReliableMessages.tsx` behind the Messaging API.
- Emit `conversation.updated`, `message.sent`, `message.received`, and `message.read` platform events.

Acceptance criteria:

- Mobile chat still sends and receives messages.
- Desktop chat still lists and opens conversations.
- Realtime updates continue working.
- No page-level messaging table writes remain in the migrated screens.

### Phase 3 - Event bus and workflow engine

Deliverables:

- Wrap or evolve `communication_events` to the canonical platform event shape.
- Generalize `orchestration-event-router` so it routes events by type and rule, not by hardcoded recruitment logic.
- Move recruitment behavior into workflow rules.
- Keep `mobile_action_queue` as the initial action queue, then generalize it to platform actions.

Acceptance criteria:

- The existing positive response -> place call -> update workspace sequence still works.
- The same event path can support a second workflow without changing the router code.

### Phase 4 - Calling API consolidation

Deliverables:

- Add a `Calling API` facade over `src/packages/communication-engine`.
- Move `CallContext`, desktop call screens, and mobile call screens to the facade.
- Treat legacy `SimpleWebRTCCall` as a temporary adapter.
- Emit call lifecycle events through the platform event bus.

Acceptance criteria:

- Incoming and outgoing calls still connect.
- Media flow is verified for desktop and mobile.
- Call outcomes land in the conversation timeline.
- Calling UI no longer directly owns call persistence.

### Phase 5 - AI Orchestrator and Agent Manager

Deliverables:

- Define the reusable agent schema: name, role, permissions, capabilities, tools, knowledge sources, confidence thresholds, escalation rules, and memory policy.
- Adapt `chatrBrain` as the first Agent Manager implementation.
- Adapt `src/lib/ai/ExecutionEngine.ts` as the first durable planning implementation.
- Connect `src/services/intelligence` as the knowledge ingestion layer.

Acceptance criteria:

- AI decisions are event-driven.
- Agents can be reused by Desktop, Mobile, Business, and Enterprise surfaces.
- Workflow actions require permissions and can escalate to a human.

### Phase 6 - Customer Zero surface migration

Deliverables:

- Desktop Workspace consumes Conversation, Calling, Workflow, Notification, and Agent APIs.
- Mobile app consumes the same APIs through platform hooks/adapters.
- Business Workspace uses platform workflows instead of custom page logic.
- Enterprise views use platform analytics and audit events.

Acceptance criteria:

- The same conversation object powers chat, calls, summaries, tasks, pipeline state, and business workflow state.
- Surface-specific code is mostly UI, layout, and local interaction behavior.

### Phase 7 - Developer platform hardening

Deliverables:

- Public SDK shape based on the internal APIs.
- API documentation.
- Event schema versioning.
- Agent registry management UI.
- Workflow builder or rules editor.
- Audit logs and analytics.

Acceptance criteria:

- A new internal app can be built without querying core Supabase tables directly.
- A new workflow can be added without editing mobile or desktop UI code.

## First Safe Implementation Slice

Start small and reversible.

1. Add shared platform types.
2. Add a local platform event facade that can publish locally and optionally persist to `communication_events`.
3. Add a Conversation API facade that wraps existing Supabase conversation and message reads.
4. Refactor only `useChatConversations.tsx` to consume the facade.
5. Keep the returned hook shape unchanged.
6. Run the build.

This gives CHATR its first Customer Zero platform API without changing user-visible behavior.

## Rules for New Work

- Do not add new direct Supabase table access inside visual components.
- Do not create a second implementation when an existing module can be adapted.
- Do not hardcode use-case logic inside generic platform services.
- Do not make destructive schema changes during migration.
- Prefer adapters first, then move callers.
- Every platform action should be traceable through a platform event or workflow run.

## Risk Register

### Schema drift

Risk: Existing tables were created for app needs, not platform API boundaries.

Mitigation: Wrap existing schema first. Add compatibility views or additive columns before changing callers.

### Duplicate event systems

Risk: Multiple event buses can cause missed events or double-processing.

Mitigation: Create one facade and adapt old buses behind it. Retire old direct use gradually.

### Calling regressions

Risk: Calling has real-time behavior and device permissions, so migration can break media flow.

Mitigation: Keep the communication engine as the source of truth. Move one caller at a time. Verify incoming, outgoing, audio, video, mute, hangup, and reconnect paths after each change.

### AI overreach

Risk: Agents could execute actions without enough context or permissions.

Mitigation: Add explicit tool permissions, confidence thresholds, approval gates, and human escalation before expanding automation.

### Product interruption

Risk: A platform rewrite would slow feature delivery.

Mitigation: Use platform APIs as wrappers first. New features use the platform boundary while older features are migrated incrementally.

## Definition of Customer Zero Done

CHATR is Customer Zero when:

- Mobile, Desktop, Business, and Enterprise surfaces use the same Conversation API.
- Messaging, Calling, Notifications, Workflows, and Agents emit canonical platform events.
- Recruitment, customer support, sales, and internal workspace flows are configured as workflows or agents, not hardcoded into generic routers.
- New features can be built through platform APIs without direct table access from UI.
- The internal platform shape is strong enough to become an external developer platform.
