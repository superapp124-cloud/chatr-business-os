# 09 Provider Integration

## Summary

CHATR has broad provider ambition across AI, Supabase, payments, travel, food, notifications, calendar, documents, and local desktop execution. Provider integration is not yet unified into Workflow Studio. Most integrations are either service-specific, UI-specific, Electron-specific, or manifest-only.

## Provider Matrix

| Provider | Authentication | Status | Where implemented | Reusable by Studio? | Production ready? |
| --- | --- | --- | --- | --- | --- |
| OpenAI | API key env | Partial | `src/services/ai.ts`, Electron adaptive intelligence | Indirect through AI service | Partial |
| Anthropic | Not implemented | Missing/placeholder | Electron provider throws/not implemented | No | No |
| Google Gemini | API key env | Partial | `src/services/ai.ts` | Indirect through AI service | Partial |
| Google Workspace/Calendar | OAuth callbacks/pages | Partial | Calendar callback pages, capabilities | Not as Studio nodes | Partial |
| AWS | Not found for Studio | Missing | None identified | No | No |
| Azure | Not found for Studio | Missing | None identified | No | No |
| Supabase | anon key/session | Production/partial | client, migrations, Edge Functions | Yes | Partial |
| Postgres | Through Supabase | Partial | Supabase direct table ops | Yes, unsafe generic DB node | Partial |
| SMTP | Not found as Studio connector | Missing | Email queue concept only | No | No |
| Twilio | API credentials likely | Partial | capability tests/functions | Not Studio node | Partial |
| Stripe | API credentials likely | Partial | capability folders/tests | Not Studio node | Partial |
| Razorpay | API key manifest | Partial | `provider-manifests/razorpay.json` | Not Studio node | Partial |
| Slack | Listed in integrations UI | Partial/static | business integrations page/static entries | Not Studio node | No |
| Discord | Not found | Missing | None identified | No | No |
| Teams | Not found as runtime connector | Missing | None identified | No | No |
| HubSpot | Not found as runtime connector | Missing | Static/product expectation only | No | No |
| Salesforce | UI/static references | Partial/static | integrations/business pages | Not Studio node | No |
| Zoho | Experimental manifest | Partial | `electron/chatr-core/manifests/zomato` is food, not Zoho CRM | No | No |
| SAP | Not found | Missing | None identified | No | No |
| Oracle | Not found | Missing | None identified | No | No |
| REST | URL/headers | Partial | Webhook executor | Yes | Partial |
| GraphQL | Not found as first-class | Missing | Could use REST manually | No | No |
| MCP | Partial | MCP server/function/dashboard references | Not Studio node | Partial |
| OpenAPI | Not found as connector import | Missing | None identified | No | No |
| IRCTC | Session/browser | Experimental | provider manifest | Not Studio node | No |
| Swiggy | Public/browser experimental | Experimental | Electron manifest | Not Studio node | No |
| Zomato | Public/browser experimental | Experimental | Electron manifest | Not Studio node | No |
| UPI | Manifest | Partial/experimental | provider manifest | Not Studio node | No |

## AI Providers

`src/services/ai.ts` route order:

1. CHATR Kernel conversation if available.
2. Electron IPC Ollama if available.
3. Local Ollama REST.
4. Cloud providers are blocked by `strictPrivacyMode = true`.
5. Gemini/OpenAI functions exist but are not reached while strict privacy remains true.
6. Supabase Edge fallback exists after cloud attempts.

This is privacy-positive but means AI Builder depends heavily on local AI availability unless product settings change.

## Payment Providers

Razorpay and UPI provider manifests show useful concepts:

- capability declarations
- auth type
- approval requirements
- idempotency support
- webhook/polling support

These are not currently exposed as Workflow Studio payment nodes.

## Food and Travel Providers

IRCTC, Swiggy, and Zomato manifests exist under provider manifests and Electron manifests. They are experimental and browser-runtime oriented.

They should not be considered production-ready workflow connectors until they have:

- stable auth/session handling
- selector maintenance plan
- provider terms review
- error handling
- rate limiting
- audit integration
- Studio node bindings

## Supabase

Supabase is the primary backend dependency:

- Auth.
- `business_workflows`.
- workflow version/run/approval/queue/policy/secrets migrations.
- Edge Functions.
- notification/email/database actions.

Current gap: direct Supabase table access is scattered. Enterprise workflow operations should be mediated by a dedicated workflow API/service boundary.

## Electron Provider Runtime

Electron core has a richer connector model than the Studio browser runtime:

- provider discovery
- credential vault
- execution runtime
- browser/API/local/simulation executors
- execution ledger

This is promising but not unified with `/desktop/studio` workflows.

## Reusability Assessment

Current provider code is reusable in pieces, but not yet reusable as a workflow connector SDK.

Needed abstractions:

- connector manifest schema
- auth strategy registry
- capability to node mapping
- input/output schema
- secret reference binding
- test connection API
- policy requirements
- rate limit metadata
- audit metadata
- error taxonomy
- webhook trigger registration

## Provider Integration Maturity

Score: 44/100.

There is significant integration surface area, but the workflow platform lacks the connector layer needed for enterprise-grade multi-provider automation.
