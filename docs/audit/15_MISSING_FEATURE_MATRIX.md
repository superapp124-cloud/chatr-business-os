# 15 Missing Feature Matrix

| Capability | Exists | Partial | Missing | Location | Notes |
| --- | --- | --- | --- | --- | --- |
| Studio route | Yes |  |  | `src/App.tsx:481` | `/desktop/studio` loads WorkflowStudio. |
| Lazy loading | Yes |  |  | `src/routes/lazyPages.tsx:384` | Route is lazy-loaded. |
| Visual canvas | Yes |  |  | `WorkflowStudio.tsx` | React Flow rendered. |
| Node drag persistence |  |  | Yes | Studio canvas | No persisted position updates. |
| Edge editing |  |  | Yes | Studio canvas | No `onConnect` in Studio route. |
| Edge persistence |  | Yes |  | `business_workflows.edges` | Alternate builder saves edges; Studio does not. |
| Undo/redo |  |  | Yes | None found | Required for serious builder UX. |
| Clipboard copy/paste |  |  | Yes | None found | Missing graph editing baseline. |
| Grouping/subflows |  |  | Yes | None found | Missing enterprise graph management. |
| Node registry |  | Yes |  | `nodeConfig`, runtime executors | Display/runtime fragmented. |
| Node SDK |  |  | Yes | None found | Needed for extensibility. |
| Typed node inputs |  |  | Yes | None found | No central schema. |
| Typed node outputs |  |  | Yes | None found | No downstream validation. |
| Forms |  | Yes |  | `form` node type | No form schema/runtime. |
| Approval node |  | Yes |  | UI node, ApprovalEngine | Not runtime-wired. |
| Condition branch |  | Yes |  | `core.condition` | No safe expression engine or branch graph semantics. |
| Loop node |  |  | Yes | None found | Missing. |
| Switch node |  |  | Yes | None found | Missing. |
| Delay node |  | Yes |  | UI type | No durable delay runtime. |
| Schedule trigger |  | Yes |  | `schedule` type | No scheduler binding. |
| Webhook action | Yes |  |  | `RuntimeAdapter.ts` | Needs security controls. |
| Webhook trigger |  |  | Yes | None found | Missing inbound workflow trigger. |
| Email action |  | Yes |  | `core.email` | Schema mismatch with execution_queue migration. |
| SMS/WhatsApp nodes |  | Yes |  | functions/integration labels | Not Studio runtime nodes. |
| CRM nodes |  |  | Yes | None found for Studio | Needed for sales/support. |
| ERP nodes |  |  | Yes | None found | Needed for finance/procurement/manufacturing. |
| Payment nodes |  | Yes |  | Razorpay manifests | Not Studio nodes. |
| File/document nodes |  | Yes |  | `document` type, document engine | No Studio runtime contract. |
| AI builder | Yes |  |  | `handleAIGenerate` | Needs validation/version trace. |
| AI action | Yes |  |  | `core.ai_agent` | Basic prompt execution only. |
| Model selector |  |  | Yes | None in Studio | Missing tenant/user control. |
| AI trace |  | Yes |  | `ai_traces` schema | Not written by Studio. |
| Workflow save | Yes |  |  | `handleSave` | Saves nodes only. |
| Autosave |  | Yes |  | alternate builder | Missing in Studio route. |
| Import |  |  | Yes | None found | Missing. |
| Export |  | Yes |  | publish menu | Compiles/logs only, no file. |
| Draft version |  | Yes |  | `WorkflowVersionManager` | Not wired to Studio. |
| Publish version |  | Yes |  | `WorkflowVersionManager` | Not called by Studio menu. |
| Scheduled publish |  |  | Yes | menu text only | No implementation found. |
| Clone workflow |  |  | Yes | menu text only | No implementation found. |
| Execution start | Yes |  |  | `handleTestRun` | Local test run only. |
| Durable execution |  | Yes |  | `workflow_runs` schema | Not written by Studio. |
| Execution queue |  | Yes |  | `execution_queue` schema | Not used by Studio. |
| Parallel execution |  | Yes |  | Electron helper | Not Studio graph runtime. |
| Retry/backoff |  | Yes |  | compile metadata | No runtime enforcement. |
| Timeout |  | Yes |  | webhook timeout | Not uniform. |
| Rollback/compensation |  |  | Yes | None found for Studio | Missing. |
| Checkpoint/resume |  | Yes |  | checkpoint schema | Not wired. |
| Run history |  | Yes |  | schema/local state | Not durable in Studio. |
| Live logs |  | Yes |  | static logs/local events | Not real durable logs. |
| Metrics |  | Yes |  | static/local metrics | Not real analytics. |
| Queue UI |  | Yes |  | static panel | Not connected to queue table. |
| Alerts |  | Yes |  | static optimizer cards | No live alert engine. |
| Audit logs |  | Yes |  | `audit_logs`, ledger | Studio runtime not writing. |
| Secrets vault |  | Yes |  | `secrets_vault`, credential vault | Not node-bound. |
| RBAC |  | Yes |  | RLS/admin helpers | No full Studio permission model. |
| Workspace sharing |  |  | Yes | None found | Missing. |
| Team collaboration |  | Yes |  | static/live UI hints | No durable permissions/edit model found. |
| Connector SDK |  | Yes |  | provider manifests | Not integrated into Studio. |
| Marketplace |  | Yes |  | integration pages | Not workflow connector marketplace. |
| Public workflow API |  |  | Yes | None unified | Direct Supabase/IPC/functions are fragmented. |
| E2E Studio tests |  |  | Yes | None found | Critical gap. |
| Migration consistency tests |  |  | Yes | None found | Needed due workflow_runs drift. |
