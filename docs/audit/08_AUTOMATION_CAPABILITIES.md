# 08 Automation Capabilities

## Capability Matrix

| Capability | Exists | Partial | Missing | Location | Notes |
| --- | --- | --- | --- | --- | --- |
| Event driven |  | Yes |  | EventBus, RuntimeAdapter | Local frontend events only for Studio. |
| Scheduled |  | Yes |  | `schedule` node type, scheduler services elsewhere | No Studio schedule trigger binding. |
| Webhook trigger |  |  | Yes | None found for Studio | Outbound webhook exists; inbound trigger missing. |
| Webhook action | Yes |  |  | `RuntimeAdapter.ts` | Uses browser `fetch`; lacks auth/secrets/SSRF controls. |
| Email trigger |  |  | Yes | None found for Studio | Email action exists partially. |
| Email action |  | Yes |  | `core.email` | Writes old `email_queue` shape. |
| SMS |  | Yes |  | Supabase `send-sms`, Twilio capability tests | Not a Studio node. |
| WhatsApp |  | Yes |  | Studio demo integrations | No verified runtime node. |
| CRM |  | Yes |  | CRM pages/folders, static labels | No Studio CRM node pack. |
| ERP |  |  | Yes | None found for Studio | Required for finance/procurement/manufacturing. |
| Calendar |  | Yes |  | capabilities and callback pages | Not a Studio node runtime. |
| Files |  | Yes |  | document engines, file pages | No file trigger/action node contract. |
| AI | Yes |  |  | AI provider, AI action, AI builder | Partial model/tool/governance support. |
| Human approval |  | Yes |  | `ApprovalEngine`, `workflow_approvals`, UI node | Not wired into RuntimeAdapter. |
| Forms |  | Yes |  | `form` node type | No form schema/runtime. |
| External APIs |  | Yes |  | Webhook executor, Edge Functions | No connector SDK or policy enforcement. |
| Database | Yes |  |  | `core.database` | Direct table ops; needs allowlists. |
| Streaming |  | Yes |  | AI `chatStream`, runtime events | Not workflow execution streaming. |
| Long-running jobs |  | Yes |  | queue/checkpoint schemas | Studio runtime is browser-local and non-durable. |
| Multi-step | Yes |  |  | Studio sequential graph | Sequential chain only in Studio. |
| Conditional |  | Yes |  | condition node/executor | No branch graph semantics in Studio. |
| Loops |  |  | Yes | None found | Required for n8n/Make-like automation. |
| Switch |  |  | Yes | None found | Multi-branch routing missing. |
| Retry |  | Yes |  | compile metadata | Runtime does not enforce retry policy. |
| Rate limits |  | Yes |  | `org_policies` schema | Not enforced by Studio runtime. |
| Queue |  | Yes |  | `execution_queue` migration | Not used by Studio runtime. |
| Concurrency |  | Yes |  | Electron runtime helper | Studio path is sequential. |
| Caching |  | Yes |  | various services/caches | No workflow node cache model. |
| Secrets |  | Yes |  | `secrets_vault`, Electron credential vault | Not bound to Studio node execution. |
| Audit logs |  | Yes |  | `audit_logs` migration, execution ledger | Studio route does not write durable audit rows. |

## Event Driven Automation

Studio uses an in-memory EventBus for run UI updates. This is useful for local feedback but not an enterprise eventing backbone.

Missing:

- Durable event store for Studio runs.
- Event subscriptions/triggers.
- Webhook receiver management.
- Idempotency keys.
- Replay controls.

## Scheduled Automation

Schedule is modeled as a type, but no Studio scheduler path was found. Enterprise scheduling needs cron/timezone support, missed-run policy, locks, and history.

## API and Webhook Automation

Outbound webhook action exists. It accepts URL, method, headers, and body.

Missing:

- Secret injection.
- OAuth/API key binding.
- URL allow/deny lists.
- SSRF protection.
- Retry/backoff.
- Response schema mapping.
- Webhook trigger endpoints.

## Human-in-the-Loop Automation

The codebase has a strong start:

- Approval node in UI.
- `workflow_approvals` table.
- `ApprovalEngine`.
- SLA/escalation fields.

The missing piece is runtime integration. Approval nodes do not pause the Studio runtime, create approval records, resume on approval, or persist waiting state from the Studio test path.

## Data and Database Automation

The database executor supports generic table actions. This is powerful but risky.

Before enterprise use, it needs:

- table allowlists
- operation allowlists
- per-node permission checks
- tenant scoping
- schema validation
- audit logging
- transaction/compensation rules

## AI Automation

AI Builder and `core.ai_agent` exist. AI capabilities are meaningful but not yet platform-hardened:

- No structured output validation at the workflow contract layer.
- No model policy by workflow/tenant.
- No token/cost budgets enforced by Studio.
- No prompt/version trace persisted with workflow runs.
- No approval policy for sensitive AI actions.

## Enterprise Automation Maturity

Automation maturity score: 40/100.

The product has many visible automation concepts but still needs a durable automation kernel, connector SDK, typed node contracts, and governance enforcement.
