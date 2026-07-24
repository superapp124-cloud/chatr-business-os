# CHATR Platform Architecture

## Purpose

This document defines the long-lived architecture for the CHATR Conversation Platform. It complements the product vision and the Customer Zero execution plan by specifying the platform services, extension model, AI tool registry, observability layer, trust model, and internal console needed for multi-year evolution.

## Core Platform Services

### Conversation Runtime

The Conversation Runtime owns the canonical conversation object.

Responsibilities:

- Conversation creation and resolution.
- Participant membership.
- Unified timeline of messages, calls, notes, tasks, summaries, workflows, and agent actions.
- Conversation-scoped permissions.
- Conversation lifecycle events.

All surfaces must consume conversations through the Conversation API.

### Messaging API

The Messaging API owns message delivery, state, and interaction behavior.

Responsibilities:

- Send, receive, edit, delete, and react to messages.
- Delivery, read, and failure states.
- Typing indicators.
- Attachment metadata.
- Messaging events.

No visual component should write directly to the `messages` table.

### Calling API

The Calling API owns call lifecycle and media session state.

Responsibilities:

- Incoming and outgoing call setup.
- Call room membership.
- Signaling abstraction.
- Audio and video capabilities.
- Call outcomes.
- Call timeline entries.

The existing `src/packages/communication-engine` remains the foundation. UI migration should happen through adapters and must not bypass call media flows.

### Event Bus

The Event Bus is the only cross-module communication path.

Canonical event shape:

```ts
interface PlatformEvent<TPayload = unknown> {
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

The Event Bus must support local publishing, durable persistence, replay for debugging, and dead-letter handling.

### Workflow Engine

The Workflow Engine owns durable automation.

Responsibilities:

- Rule evaluation.
- Workflow runs and step history.
- Retries and failure handling.
- Human approval gates.
- Action queues.
- Escalation.

Use-case logic such as recruitment, support, collections, or sales must live as workflow configuration or agent plans, not in generic routers.

### AI Orchestrator

The AI Orchestrator decides what should happen.

Responsibilities:

- Intent classification.
- Planning.
- Agent selection.
- Tool selection.
- Confidence scoring.
- Escalation decisions.
- Memory access policy.

It should compose existing `src/services/chatrBrain`, `src/lib/ai`, and `src/services/intelligence` behind one platform boundary.

### Agent Manager

The Agent Manager owns reusable agents.

Agent schema:

```ts
interface PlatformAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  permissions: string[];
  capabilities: string[];
  toolIds: string[];
  knowledgeSourceIds: string[];
  confidenceThresholds: Record<string, number>;
  escalationRules: string[];
  memoryPolicy: 'none' | 'session' | 'conversation' | 'workspace';
  status: 'draft' | 'active' | 'deprecated' | 'retired';
}
```

Agents must never call platform services directly. They request tools through the Tool Registry.

## AI Tool Registry

The Tool Registry is the gateway between AI agents and platform capabilities.

Flow:

```text
AI Agent
  -> AI Orchestrator
  -> Tool Registry
  -> Permission Check
  -> Platform API
  -> Event Bus
```

Initial tool families:

- Calendar.
- Calling.
- Messaging.
- CRM.
- Browser.
- Payments.
- Search.
- Files.
- Email.
- Notifications.
- Workflows.
- Contacts.

Tool contract:

```ts
interface AiToolDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  requiredPermissions: string[];
  inputSchema: unknown;
  outputSchema: unknown;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}
```

Tool executions must emit events and write audit records. New tools should be added by registration, not by editing the AI Orchestrator.

## Plugin And Extension Framework

The plugin framework lets internal teams and external developers extend the platform without coupling to app internals.

### Plugin Lifecycle

States:

- Draft.
- Submitted.
- Approved.
- Installed.
- Active.
- Suspended.
- Deprecated.
- Retired.

### Plugin Package

A plugin package should define:

- Manifest.
- Requested permissions.
- Event subscriptions.
- Tool registrations.
- UI surfaces.
- Webhook endpoints.
- Version.
- Update policy.

Manifest shape:

```ts
interface PlatformPluginManifest {
  id: string;
  name: string;
  publisherId: string;
  version: string;
  description: string;
  permissions: string[];
  eventSubscriptions: string[];
  tools: string[];
  surfaces: Array<'desktop' | 'mobile' | 'business' | 'admin'>;
  entrypoints: Record<string, string>;
}
```

### Sandboxed Execution

Plugins should run through constrained execution boundaries:

- No direct database access.
- No unapproved network destinations.
- No access to secrets.
- No direct call/media control.
- All platform access through SDK APIs.
- All side effects audited.

### Plugin Marketplace

The marketplace should support:

- Review workflow.
- Publisher identity.
- Version history.
- Compatibility metadata.
- Workspace install/uninstall.
- Permission review.
- Rollback.
- Abuse reporting.

## Observability

Observability is a core platform service.

Required signals:

- Event tracing.
- Workflow execution history.
- AI decision logs.
- Agent execution logs.
- Tool execution logs.
- API latency.
- Conversation timeline health.
- Realtime delivery health.
- Calling quality metrics.
- Failure analysis.
- Distributed tracing through correlation IDs.

Every user-visible action should be traceable from UI action to platform API, event, workflow, tool, and persistence record.

## Security And Trust

Security must be built into the platform boundary.

Required capabilities:

- API authentication.
- Workspace and tenant isolation.
- Role-based and attribute-based permissions.
- Device trust.
- Consent management.
- Audit trails.
- Secret management.
- Rate limiting.
- Abuse detection.
- Data retention policy.
- End-to-end encryption where appropriate.
- Approval gates for high-risk actions.

Trust-sensitive operations include:

- Sending a message.
- Placing a call.
- Reading private conversation context.
- Accessing files.
- Accessing browser history.
- Taking payment actions.
- Changing workflow rules.
- Installing plugins.
- Granting agent permissions.

## Platform Console

The Platform Console is the internal operations surface for CHATR as Customer Zero.

It should inspect:

- Conversations.
- Events.
- Workflow runs.
- Agents.
- Tool executions.
- API calls.
- Integrations.
- Permissions.
- Performance.
- Errors.
- Dead-letter events.
- Call quality.

The console should not be a separate product first. It should be the internal control plane used to keep the platform coherent while CHATR migrates onto it.

## Architecture Acceptance Criteria

The platform architecture is ready when:

- Each major capability has a typed API boundary.
- Cross-module communication uses platform events.
- Agents use the Tool Registry.
- Workflows have durable execution history.
- Security decisions happen at platform boundaries.
- Observability can trace a full user action end to end.
- Plugins can be installed without direct database access.
- The Platform Console can inspect and debug core behavior.
