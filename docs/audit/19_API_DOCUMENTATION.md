# 19 API Documentation

## Summary

Workflow Studio does not use a single workflow API. It relies on direct Supabase table calls, local browser runtime calls, a separate Supabase Edge Function, Electron IPC channels, and a local Express retrieval server. This report documents the API surfaces found during audit and marks whether Studio uses them.

## Supabase Direct Table API

### `business_workflows`

Used by: `src/hooks/useBusinessWorkflows.ts`

Operations:

| Operation | Input | Output | Auth | Errors | Used by Studio |
| --- | --- | --- | --- | --- | --- |
| Select workflows | Supabase user id from `auth.getUser()` | `BusinessWorkflow[]` | Supabase auth/RLS | Hook sets error state | Yes |
| Insert workflow | `name`, `description`, `profile_id`, empty nodes/edges, draft status | Inserted workflow row | Supabase auth/RLS | Hook sets error state | Yes |
| Update workflow | workflow id and partial fields | Updated local state after success | Supabase auth/RLS | Hook sets error state | Yes |

Important limitation: update is by id at client level and relies on RLS for ownership protection.

### Runtime direct table operations

Used by: `src/platform/AutomationOS/RuntimeAdapter.ts`

| Operation | Input | Output | Auth | Errors | Used by Studio |
| --- | --- | --- | --- | --- | --- |
| Insert email | to/subject/body into `email_queue` | inserted row or error | Supabase session | throws on insert error | Partial |
| Insert notification | user id/title/message/type/data | inserted row or error | Supabase session | throws on insert error | Partial |
| Generic database action | table/action/payload | selected/inserted data | Supabase session/RLS | throws on query error | Partial |

Risk: `email_queue` was renamed/morphed to `execution_queue` in migration `20260709000006`, so the email executor may be schema-incompatible.

## Supabase Edge Function: `business-workflow-engine`

File: `supabase/functions/business-workflow-engine/index.ts`

Input:

```json
{
  "workflowId": "uuid",
  "payload": {}
}
```

Auth:

- Expects `Authorization` header.
- Creates a Supabase client with the request auth header.

Behavior:

1. Fetches one row from `business_workflows`.
2. Skips execution if `workflow.status !== "active"`.
3. Reads `nodes` and `edges`.
4. Finds a `trigger` node.
5. Simulates traversal for up to 10 steps.
6. Handles `ai_decision` and `action` types specially.
7. Updates `business_workflows.run_count`.
8. Returns an execution log.

Success output:

```json
{
  "success": true,
  "message": "Workflow executed successfully",
  "executionLog": []
}
```

Skip output:

```json
{
  "success": true,
  "message": "Workflow not active, skipping"
}
```

Error output:

```json
{
  "error": "message"
}
```

Used by Studio: no direct call found.

## Other Supabase Edge Functions

The repository contains many Edge Functions. Relevant categories include:

- AI: `ai-chat`, `ai-agent-chat`, `ai-answer`, `ai-assistant`, `ai-image-generator`, `universal-ai-search`, `visual-intelligence`.
- Notifications: `send-sms`, `send-push`, `send-whatsapp-invite`, `send-chat-notification`, `process-scheduled-notifications`.
- Auth/device/desktop: `auth-phone-otp`, `desktop-pair-init`, `desktop-pair-confirm`, `device-auth`, `qr-login`.
- Search/retrieval: `universal-search`, `universal-search-engine`, `search-memory`, `web-search-aggregator`.
- Orchestration: `orchestration-event-router`, `persist-events`, `platform-init`.
- Workflow-specific: `business-workflow-engine`.

Most are not directly used by `/desktop/studio` based on the audited route.

## Local Express API

File: `server/src/server.ts`

Endpoints:

| Method | Path | Input | Output | Auth | Used by Studio |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/search/fast-stream` | query parameters | streaming search response | not identified | No direct Studio use found |
| GET | `/api/search/agent` | query parameters | streaming search response | not identified | No direct Studio use found |

Vite proxies `/api` to `localhost:8787`, but Workflow Studio does not rely on these search endpoints.

## Electron IPC API

Files:

- `electron/preload.cjs`
- `electron/main.cjs`

Relevant IPC channels:

| Channel | Input | Output | Used by Studio |
| --- | --- | --- | --- |
| `kernel:intent:submit` | intent request | kernel result | Not directly by Studio route |
| `kernel:intent` | intent request | kernel result | Not directly by Studio route |
| `kernel:intent:process` | intent text | execution session/result | Not directly by Studio route |
| `kernel:intent:resume` | session/follow-up | resumed result | Not directly by Studio route |
| `kernel:execution:approve` | node id | approval result | Not directly by Studio route |
| `kernel:execution:reject` | node id | rejection result | Not directly by Studio route |
| `execution:connect-service` | connector id | connection result | Not directly by Studio route |
| `execution:get-connected-services` | none | service list | Not directly by Studio route |
| `execution:disconnect-service` | connector id | disconnect result | Not directly by Studio route |
| `execution:get-background-jobs` | none | job list | Not directly by Studio route |
| `execution:cancel-background-job` | job id | cancellation result | Not directly by Studio route |
| `marketplace:get-catalog` | none | connector catalog | Not directly by Studio route |
| `marketplace:install` | manifest | install result | Not directly by Studio route |
| `marketplace:remove` | connector id | removal result | Not directly by Studio route |
| `documents:search` | query, limit | document results | Not directly by Studio route |
| `documents:read` | file path | document content | Not directly by Studio route |
| `documents:open` | file path | OS open result | Not directly by Studio route |

Execution event channels exposed by preload:

- `execution:plan_started`
- `execution:node_started`
- `execution:node_awaiting_approval`
- `execution:node_completed`
- `execution:plan_completed`
- `execution:browser_step`
- `execution:capability_started`
- `execution:capability_completed`

These are relevant to Electron runtime, but the audited Studio route uses AutomationOS EventBus instead.

## Frontend Command API

`src/platform/AutomationOS/CommandBus.ts` acts as an internal command API:

| Command | Input | Output | Used by Studio |
| --- | --- | --- | --- |
| `LOAD_WORKFLOW` | nodes, edges, workflow id | updates KernelStore | Yes |
| `GENERATE_WORKFLOW` | intent | publishes generated graph | Yes |
| `COMPILE_WORKFLOW` | none | logs compiled graph | Yes/indirect |
| `RUN_WORKFLOW` | intended workflow payload | executes KernelStore graph | Yes |
| `CREATE_NODE` | node payload | publishes node created | Not main canvas edit path |
| `CREATE_EDGE` | edge payload | publishes edge created | Not main canvas edit path |
| `MOVE_NODE` | id, position | publishes event | Not main canvas edit path |
| `RECOMMEND_FIX` | recommendation | publishes fix event | Self-healing |

Risk: `RUN_WORKFLOW` ignores command payload graph content.

## API Gaps

Missing workflow API contracts:

- create workflow
- update graph with optimistic lock
- validate graph
- compile graph
- publish version
- schedule publish
- start run
- cancel run
- retry run/node
- resume run
- approve/reject node
- list runs
- get run trace
- list queue items
- register webhook trigger
- test connector
- bind secret
- audit export

## API Maturity

API score: 40/100.

The platform has many interfaces, but not the unified workflow API needed for enterprise automation.
