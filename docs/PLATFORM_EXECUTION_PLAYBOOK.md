# CHATR Platform Execution Playbook

## Purpose

This playbook defines how the CHATR Platform evolves safely over many years. It covers governance, versioning, deprecation, compatibility, permissions, testing, releases, and Customer Zero success metrics.

## Platform Governance

### Module Lifecycle

Every platform module must have one lifecycle state:

- `experimental`: can change quickly, not used by critical paths.
- `beta`: usable by internal surfaces, API may still evolve.
- `stable`: safe for production surfaces.
- `deprecated`: supported but should not gain new consumers.
- `retired`: removed from active use.

Stable modules require:

- Typed API contracts.
- Ownership.
- Tests for core behavior.
- Observability events.
- Security review for sensitive data or actions.
- Migration notes.

### Ownership

Each module must have:

- Owner.
- Backup owner.
- Runtime dependencies.
- Data dependencies.
- Public API surface.
- Operational dashboard or console view.

### API Versioning

Rules:

- All platform APIs are versioned.
- Breaking changes require a new major version.
- Additive changes are allowed in the current version.
- Consumers must declare the version they use.
- Stable APIs must support at least one previous major version during migration.

API examples:

- `ConversationAPI v1`.
- `MessagingAPI v1`.
- `CallingAPI v1`.
- `WorkflowAPI v1`.
- `AgentAPI v1`.

### Event Versioning

Rules:

- Every event includes a `version`.
- Event names are stable.
- Payload changes are additive unless version is incremented.
- Consumers must ignore unknown fields.
- Deprecated event versions must have a migration deadline.

Event examples:

- `message.received v1`.
- `conversation.updated v1`.
- `call.ended v1`.
- `workflow.step.completed v1`.
- `agent.tool.executed v1`.

### Deprecation Policy

Deprecation requires:

- Replacement API or event.
- Migration guide.
- Owner.
- Deadline.
- Usage report.
- Console warning for active consumers.

Default timelines:

- Internal experimental APIs: 2 weeks.
- Internal stable APIs: 60 days.
- External developer APIs: 180 days.

### Backward Compatibility

Compatibility rules:

- UI surfaces should consume platform facades, not tables.
- Adapters may translate old schema to new contracts.
- Destructive schema changes are prohibited until all consumers migrate.
- Event consumers must be idempotent.
- Workflow steps must tolerate replay.

### Feature Flags

Feature flags are required for:

- New platform APIs.
- New workflow execution paths.
- New AI tools.
- Plugin installs.
- Permission model changes.
- Calling changes.
- Database-backed migrations with user-facing impact.

Flags must have:

- Owner.
- Rollout plan.
- Rollback plan.
- Expiry date.
- Metrics.

### Workspace Permissions

Workspace permissions should be centralized.

Permission domains:

- Conversation.
- Messaging.
- Calling.
- Workflow.
- Agent.
- Tool.
- Plugin.
- Billing.
- Admin.
- Audit.

No agent, plugin, or UI surface should bypass workspace permission checks.

## Migration Standards

Use the strangler pattern.

1. Add the platform facade.
2. Adapt the old implementation behind it.
3. Move one consumer.
4. Emit events in parallel.
5. Verify behavior.
6. Move the next consumer.
7. Remove old direct access only after usage reaches zero.

No migration should break messaging, calling, authentication, or existing workspace navigation.

## Coding Standards

Required:

- New UI code calls platform APIs or platform hooks.
- New modules publish platform events.
- New AI behavior uses the Tool Registry.
- New workflows use the Workflow Engine.
- New sensitive actions emit audit logs.
- New platform code includes tests proportional to risk.

Avoid:

- Direct Supabase table access in visual components.
- Hardcoded business logic inside generic routers.
- Duplicate calling, messaging, or workflow stacks.
- Agent code calling services directly.
- Silent failures for platform actions.

## Testing Standards

Core platform services should target 90%+ automated test coverage.

Required test layers:

- Unit tests for pure platform contracts.
- Adapter tests for Supabase and local runtime boundaries.
- Workflow execution tests.
- Event replay/idempotency tests.
- Permission tests.
- AI tool approval tests.
- Calling smoke tests for UI migration boundaries.
- End-to-end tests for Customer Zero flows.

Calling tests must verify:

- Incoming call.
- Outgoing call.
- Audio flow.
- Video flow.
- Mute/unmute.
- Hangup.
- Reconnect.
- Route guards around AI overlays.

## Release Process

Each platform release should include:

- API change summary.
- Event change summary.
- Migration notes.
- Feature flags.
- Rollback plan.
- Observability dashboard links.
- Known risks.
- Test evidence.

High-risk releases require staged rollout:

1. Local development.
2. Internal desktop.
3. Internal mobile.
4. Customer Zero workspace.
5. Limited external users.
6. General availability.

## Observability Requirements

Every platform action should include:

- Correlation ID.
- Actor.
- Workspace.
- Conversation when applicable.
- API name and version.
- Event type and version.
- Duration.
- Outcome.
- Error details when failed.

AI and workflow actions must also include:

- Agent ID.
- Tool ID.
- Confidence score where applicable.
- Approval status.
- Escalation reason.
- Runtime route.

## Security Review Gates

Security review is required for:

- New API authentication flows.
- New plugin permissions.
- New AI tools.
- New payment actions.
- New file access.
- New calling behavior.
- New browser/history access.
- New workspace admin permissions.
- New secret storage.

Trust review is required for:

- Caller ID.
- Scam detection.
- Consent.
- Health data.
- Financial data.
- Device trust.
- User impersonation or agent delegation.

## Platform Console Roadmap

Phase 1:

- Event explorer.
- Conversation inspector.
- Workflow run viewer.
- Agent/tool execution log.

Phase 2:

- API latency dashboard.
- Dead-letter queue.
- Permission inspector.
- Integration health.

Phase 3:

- Plugin manager.
- Release dashboard.
- Feature flag dashboard.
- Incident timeline.

## Customer Zero Success Metrics

The migration is successful when:

- 100% of messages are processed through the Conversation Runtime or Messaging API.
- 100% of calls are routed through the Calling API.
- 100% of workflows execute through the Workflow Engine.
- 100% of cross-module communication uses the Event Bus.
- 0 visual components write directly to core platform tables.
- 0 business workflows are duplicated separately in mobile and desktop.
- 0 agents bypass the Tool Registry.
- 90%+ automated test coverage exists for core platform services.
- 100% of high-risk actions have audit trails.
- 100% of platform APIs have owners and version numbers.
- 100% of stable events have schemas and versions.
- Every production incident can be traced by correlation ID.

## Definition Of Done For Platform Work

A platform change is done when:

- It has a typed contract.
- It has an owner.
- It emits or consumes versioned events when appropriate.
- It enforces permissions.
- It has tests.
- It has observability.
- It is behind a feature flag if rollout risk exists.
- It has migration notes when replacing old behavior.
- It does not break messaging, calling, auth, or existing workspace flows.
