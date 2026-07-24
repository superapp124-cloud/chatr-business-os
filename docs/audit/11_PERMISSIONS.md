# 11 Permissions

## Summary

Permissions exist mainly as Supabase RLS policies and isolated service helpers. Workflow Studio does not yet provide a complete permission model for workspace sharing, team editing, publishing, execution, node access, credential access, or approval routing.

## Authentication

Authentication is Supabase-based for the web/desktop route:

- `useBusinessWorkflows.ts` calls `supabase.auth.getUser()`.
- Without a user, the hook does not fetch workflows.
- The in-app browser redirected to `/auth`, confirming authentication is required in that context.

## RBAC

Role-based access appears in Supabase RLS helper usage such as `has_role(auth.uid(), 'admin')` in newer migrations. However, Studio does not expose a role model for:

- workflow owner
- workflow editor
- workflow viewer
- publisher
- executor
- approver
- admin
- auditor

## Workspace and Team Permissions

The Studio UI shows team members in a static `TEAM` array and the screenshot shows live collaborators. The audited code does not show durable collaboration permissions for:

- team membership
- workspace membership
- workflow sharing
- role assignment
- per-workflow access
- concurrent edit control

Newer schemas use `tenant_id`, but the Studio route does not visibly enforce tenant or workspace scope beyond Supabase auth and RLS.

## Workflow Ownership

`useBusinessWorkflows.fetchWorkflows()` queries `business_workflows` by `profile_id = user.id`.

`updateWorkflow()` updates by workflow id. It does not include `profile_id = user.id` in the client query, so protection depends on database RLS.

## Sharing

No workflow sharing model was found in Studio:

- no share dialog
- no shared users table in the Studio path
- no role assignment UI
- no read-only collaborator mode
- no reviewer/publisher workflow

## Approval Permissions

Approval infrastructure exists:

- `workflow_approvals` table.
- `ApprovalEngine.requestApproval()`.
- `ApprovalEngine.resolve()`.
- RLS based on assigned users or admin role.

Gaps:

- Studio approval nodes do not call ApprovalEngine.
- Approval assignment UI is not wired into node config.
- Role-based approval routing is not enforced by runtime.
- Approval SLA escalation is service-level code, not connected to Studio run lifecycle.

## Publishing Permissions

`WorkflowVersionManager.publish()` checks the current Supabase user, but the Studio publish menu does not call it.

Missing:

- publisher role
- maker/checker flow
- publish approval
- version lock
- scheduled publish authorization
- publish audit trail from the Studio route

## Execution Permissions

Current Studio execution is a local test run. There is no visible execution permission check for:

- who may run a workflow
- which nodes a user may execute
- which credentials a run may use
- which external domains a workflow may call
- rate/cost limits per user or tenant

## Node Permissions

No node-level permission model was found.

Needed:

- node capability requirements
- required scopes
- required credential reference
- approval requirement metadata
- allowlists/denylists
- data classification
- safe-mode validation before publish/run

## Credential and Secret Permissions

Credential infrastructure:

- Supabase `secrets_vault` table.
- Electron credential vault using safeStorage or AES-256-GCM fallback.

Studio runtime does not bind node execution to secret references or credential scopes. Webhook and database nodes can use arbitrary config values without a formal secret binding.

## Policy Engine

`org_policies` schema exists and can represent governance rules. Studio runtime does not evaluate this schema before node execution.

## Permissions Readiness

Permissions score: 34/100.

The database foundation is promising, but Studio needs a coherent authorization layer across workflow CRUD, publish, execution, nodes, credentials, approvals, teams, and audits.
