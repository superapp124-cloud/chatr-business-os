# 04 Node Registry

## Summary

There is no centralized production-grade node registry for Workflow Studio. Node types are declared in multiple places:

- `NodeType` union in `src/pages/desktop/WorkflowStudio.tsx`.
- `nodeConfig` display mapping in `WorkflowStudio.tsx`.
- `BLOCK_TYPES` add menu in `WorkflowStudio.tsx`.
- Runtime executors in `src/platform/AutomationOS/RuntimeAdapter.ts`.
- AI planner target types in `src/platform/AutomationOS/AIProvider.ts`.
- Alternate node types in `src/components/business/automation/WorkflowBuilder.tsx`.

The registry is therefore display-led, not capability-led. Several node types appear in the UI but have no matching executor. Several runtime executor types are not exposed as configured Studio nodes.

## Studio Node Types

`WorkflowStudio` declares these node types:

```text
trigger
form
ai_screen
approval
notification
condition
email
ai_action
integration
webhook
schedule
database
delay
document
```

## Addable Blocks

`BLOCK_TYPES` exposes these addable blocks:

```text
form
ai_screen
ai_action
approval
condition
notification
email
document
integration
webhook
delay
database
```

`trigger` and `schedule` are in the type union/config, but are not in the add-block list observed in Studio.

## Runtime Executors

`RuntimeAdapter.ts` implements executors for:

```text
core.trigger
core.ai_agent
core.email
core.webhook
core.condition
core.notification
core.database
```

`handleTestRun()` maps:

- `trigger` to `core.trigger`
- `ai_action` to `core.ai_agent`
- `email` to `core.email`
- all other types remain as their raw type

This means many Studio nodes are not executed by a real executor during test runs.

## Node Inventory

| Node | Purpose | Inputs | Outputs | Configuration | Execution today | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Trigger | Starts workflow | External/manual payload | Trigger event | Trigger type, payload | `core.trigger` returns triggered payload | No trigger registry, no webhook/schedule binding from Studio |
| Schedule | Time-based start | Time/cron | Trigger event | Not exposed in add menu | No Studio executor mapping | No scheduler binding found for Studio |
| Form | Collect user input | Form fields | Submitted data | Not implemented in registry | No runtime executor | No form schema, validation, storage |
| AI Screen | Evaluate candidate/data | Text/profile/document data | Score/decision | Demo node only | No runtime executor mapping | No defined input/output schema |
| AI Action | AI task/agent | Prompt/context | AI result | Prompt/data passed to `generate` | `core.ai_agent` | No tool contracts, cost controls, structured output guarantee |
| Approval | Human approval gate | Request/context/assignees | Approved/rejected | Approval routing not wired in node config | No RuntimeAdapter executor | `ApprovalEngine` exists separately but not wired |
| Notification | Send notification | Recipient/message | Notification row | Basic fields from node data | `core.notification` inserts `notifications` | No provider abstraction, no templates, no delivery status |
| Condition | Branch decision | Expression/data | Boolean result | `expression` string | `core.condition` uses sanitized `new Function` | Unsafe and does not evaluate workflow context robustly |
| Email | Send email | to/subject/body | queued email | to, subject, body | `core.email` inserts `email_queue` | Schema drift: migration renames/drops `email_queue` columns |
| Integration | Generic external app action | Provider/action/payload | Provider response | Not defined | No runtime executor | No provider SDK binding |
| Webhook | HTTP request | URL/method/headers/body | HTTP response | URL, method, headers, body | `core.webhook` fetches URL | No SSRF guard, secrets, retry, auth policy |
| Database | DB operation | table/action/payload | query result | table/action/payload | `core.database` direct Supabase table op | Powerful and broad; missing allowlist and row policy UI |
| Delay | Wait | duration/time | continuation | Not defined | No runtime executor | No durable timer/queue integration |
| Document | Document action | file/document data | extracted/generated data | Not defined | No runtime executor | Document engine exists elsewhere but not wired |

## Requested Enterprise Node Types

| Node family | Exists | Notes |
| --- | --- | --- |
| Trigger | Partial | UI/runtime exists, but not connected to external trigger registry. |
| Delay | Partial UI | No durable wait executor. |
| Condition | Partial | Runtime expression executor exists, but security/model is weak. |
| Email | Partial | Executor writes old `email_queue` shape. |
| HTTP/REST | Partial | Webhook executor uses browser `fetch`. |
| AI | Partial | AI action maps to `core.ai_agent`; broader agent/tooling not formalized. |
| CRM | Missing in Studio | CRM pages/capabilities exist elsewhere but not Studio nodes. |
| Webhook | Partial | Outbound webhook only; inbound webhook trigger not wired. |
| Database | Partial | Direct Supabase table operations. |
| Approval | Partial | UI node and ApprovalEngine exist separately; not runtime-integrated. |
| Notification | Partial | Inserts notification rows. |
| Loop | Missing | No loop node semantics. |
| Switch | Missing | No multi-branch switch node. |
| Transform | Missing | No data transform node contract. |
| Schedule | Partial | Type exists, no Studio scheduler path. |
| Manual | Partial | Test Run acts as manual start, but no manual trigger node contract. |
| User Input | Partial | Form node exists without schema/runtime. |
| File | Missing in Studio | Document node exists, but no file trigger/action contract. |
| Payment | Missing in Studio | Razorpay manifests/capabilities exist elsewhere. |
| Custom | Missing | No custom node SDK or plugin node registration found. |

## Inputs and Outputs

The current system does not define typed node inputs and outputs in a central schema. Runtime tasks pass `task.data` into an executor and store output under `context[task.nodeId]`. There is no schema validation between adjacent nodes.

## Configuration Model

Configuration is ad hoc:

- UI nodes have `label`, `description`, `owner`, `integration`, and metrics.
- Runtime nodes use arbitrary `data`.
- Compiled nodes include `config: n.data || {}` plus fixed retry and timeout.

Missing:

- Required field metadata.
- Secrets field metadata.
- Credential binding metadata.
- Output schema metadata.
- UI form schema.
- Validation rules.
- Node versioning.
- Capability permission descriptors.

## Execution Coverage

The current execution coverage is narrow:

- Good enough for simple demo trigger, AI, email, webhook, condition, notification, and database actions.
- Not enough for enterprise approval, long-running jobs, queues, forms, document processing, file events, CRM/ERP actions, transformations, loops, switches, retries, or compensation.

## Registry Readiness

Node registry maturity score: 22/100.

The platform needs a formal node SDK/registry before it can support Salesforce Flow, Power Automate, Zapier, Make, n8n, or ServiceNow-like extensibility.
