# 13 Security

## Summary

Security foundations exist in Supabase auth/RLS, secrets vault schema, Electron credential vault, privacy-first AI routing, and audit table design. The Workflow Studio route still has several enterprise security gaps: unsafe condition execution, generic database action exposure, arbitrary webhook URLs, unbound secrets, fragmented audit, and incomplete authorization around publish/run/node capabilities.

## Authentication

Studio uses Supabase authentication through the shared Supabase client. The route redirects unauthenticated browser sessions to `/auth`.

Strengths:

- Authenticated workflow fetch.
- Persistent Supabase session.
- RLS policies in migrations.

Gaps:

- No Studio-specific session or device policy visible.
- No step-up auth for publish, payment, approval, or secrets actions.

## Authorization

Authorization is mostly database RLS and not a workflow service layer.

Risk areas:

- `updateWorkflow()` updates by workflow id only at the client query layer.
- Runtime database action can target arbitrary configured tables.
- Webhook action can call arbitrary URLs.
- Publish menu has no role or policy check.

## Secrets and Credentials

Security assets:

- `secrets_vault` stores vault references rather than plaintext.
- Electron credential vault uses Electron `safeStorage` when available.
- AES-256-GCM fallback exists for Electron credential vault.

Gaps:

- Studio webhook/database/email nodes do not reference `secrets_vault`.
- No secret picker or scope binding was found.
- Electron fallback key is deterministic per host context, not enterprise KMS.
- Existing hard-coded TURN credential fallbacks were found in WebRTC/calling code, which should be treated as a broader app security risk even if not Studio-specific.

## Encryption

Supabase handles transport/security at service level. Electron credential vault encrypts at rest locally.

Missing for workflow enterprise:

- per-tenant key model
- KMS-backed secrets
- secret rotation workflow
- audit of secret use per run
- encrypted run payload policy

## Audit Logging

`audit_logs` migration is append-only by policy intent. Electron `execution_ledger` also records local execution metadata.

Studio runtime does not write audit logs for:

- test run started/completed
- node executed
- workflow saved
- workflow published
- AI generated workflow
- approval decisions
- credential use

## Token Handling and API Keys

AI provider keys are environment-based. Provider manifests define auth needs. Studio runtime lacks a credential abstraction for nodes.

## CSRF

No dedicated CSRF review was performed. Supabase client calls are token-authenticated. Any future HTTP workflow API should include CSRF or same-site protections if browser-cookie auth is used.

## XSS

No direct XSS exploit was verified in this audit. However, workflow node labels/descriptions, logs, and external response bodies should be treated as untrusted. The route should avoid rendering untrusted HTML and should sanitize any rich content.

## Injection

High-risk item:

- `core.condition` uses `new Function('return ' + sanitized)()`.

Even with simple sanitization, this is not a safe enterprise expression engine. It also does not provide a clear data context. Replace with a sandboxed expression evaluator or rules engine before production enterprise use.

## Webhook Security

`core.webhook` performs browser `fetch` to configured URL.

Missing:

- domain allowlist
- private network block/SSRF protection
- auth through secret references
- response size/time limits beyond timeout
- retry/idempotency policy
- audit of target URL

## Database Action Security

`core.database` performs generic Supabase table operations based on node data.

Missing:

- table allowlist
- operation allowlist
- schema validation
- row-level tenant guard at workflow service layer
- audit of table/action/payload
- privileged action separation

## Workflow Sandboxing

The Studio runtime executes in the browser context and can call configured webhooks and Supabase tables. There is no sandbox boundary for node execution. For enterprise use, workflow execution should happen in controlled workers with policy checks, secrets injection, network controls, and durable audit.

## Security Score

Security score: 41/100.

Security architecture is partially present, but key Studio runtime behaviors are not hardened enough for enterprise automation.
