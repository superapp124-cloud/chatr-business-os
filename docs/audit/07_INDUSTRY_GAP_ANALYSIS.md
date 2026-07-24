# 07 Industry Gap Analysis

## Summary

CHATR Studio currently demonstrates a recruitment-style workflow and contains adjacent capabilities for commerce, healthcare, finance, communications, documents, and travel. It is not yet ready to support large enterprise automation across industries because Studio lacks a formal node SDK, durable execution, connector marketplace, governance, audit-ready run history, and robust secrets/permissions integration.

## Industry Matrix

| Industry | Supported today | Partial | Missing | Critical blockers | Recommended capability | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Recruitment | Demo workflow, candidate-style nodes, recruiter panels | AI screen, approval, interview scheduling shown | ATS connectors, durable approvals, resume/document pipeline | Demo data is static and execution is not domain-specific | ATS connector pack, resume parser, interview scheduler, offer approval | Critical |
| Sales | Static Sales Pipeline project, CRM folders/pages | Basic notification/email/webhook/database actions | Salesforce/HubSpot/Zoho nodes, lead routing, SLA, enrichment | No CRM node registry or connector auth | CRM connector SDK and lead workflow templates | High |
| Marketing | No dedicated Studio workflow | Email/webhook could be reused | Campaign triggers, segmentation, consent, A/B tests | No audience/consent model | Marketing automation nodes and compliance model | High |
| Customer Support | Static Customer Support project, Zendesk/Jira labels in agent demo | Notification/webhook/database | Ticket triggers, SLA queues, escalation, knowledge base | No durable queue/SLA runtime | Support ticket connector pack and SLA engine | Critical |
| Finance | Static Finance project, expense/payment capabilities elsewhere | Razorpay/UPI manifests, approval schemas | Ledger-grade audit, dual control, limits, reconciliation | Studio cannot enforce policy/approval/secrets | Finance policy engine and payment nodes | Critical |
| Healthcare | Healthcare pages/capabilities elsewhere | Document/notification concepts | HIPAA-style audit, PHI controls, integrations, consent | No enterprise security isolation in Studio | Healthcare workflow pack, consent, audit export | Critical |
| Legal | No dedicated support | Document node concept | Matter management, contract review, e-signature, privilege controls | No document workflow runtime | Legal document and approval connectors | High |
| Insurance | No dedicated support | Forms, approval, document concepts | Claims intake, underwriting, fraud checks, external data | No long-running case workflow | Claims workflow template and rules engine | High |
| Manufacturing | No dedicated support | Webhook/database generic actions | ERP/MES connectors, inventory, IoT triggers | No ERP/IoT connector layer | ERP and inventory node pack | High |
| Education | No dedicated support | Forms/notification concepts | LMS/SIS connectors, student records, permissions | No FERPA-style access model | Education connector templates | Medium |
| Government | No dedicated support | Forms/approval/audit concepts | Strong compliance, records retention, identity assurance | No policy-backed publish/run controls | Records/audit/identity governance | Critical |
| Real Estate | No dedicated support | Forms/document/approval concepts | CRM/listings/e-sign/payment connectors | No connector registry | Real estate CRM and document pack | Medium |
| Logistics | Travel/logistics capability folders exist | Webhook/database can model simple flows | Shipment events, carrier APIs, route optimization | No streaming/event triggers | Logistics event connector pack | High |
| Procurement | Payment/provider manifests, approval tables | Approval schema, secrets schema | Vendor catalog, PO, ERP, multi-approval | Approval nodes not runtime-wired | Procurement approval and ERP connectors | Critical |
| HR | Static HR & Onboarding project | Candidate/interview, onboarding demo | HRIS connectors, employee lifecycle, access provisioning | No durable onboarding execution | HRIS connector pack and access tasks | High |
| IT Operations | Some core OS/services and alerts | Webhook/database, policy engine schema | Incident triggers, runbooks, secrets, approvals | No runbook runtime or secrets binding | ITSM/runbook node pack | Critical |
| DevOps | No dedicated Studio support | Webhook can call APIs | GitHub/Jira/CI/CD nodes, rollback, approvals | No deployment safety model | DevOps connector pack and deployment gates | High |
| Security | Policy/secrets/audit tables exist | Credential vault, audit schemas | SIEM/SOAR, isolation, approvals, immutable logs | Studio runtime can perform unsafe dynamic actions | SOAR nodes, sandbox, immutable audit | Critical |

## Enterprise Company Validation

| Company type | Current fit | Why |
| --- | --- | --- |
| Amazon | Not ready | Needs massive scale, queues, retries, audit, IAM, service integrations, and workflow durability. |
| Google | Not ready | Requires strong security boundaries, extensibility, testing, and multi-tenant governance. |
| Microsoft | Not ready | Would expect Power Automate-level connector registry, versioning, and compliance controls. |
| Accenture | Partial for demos | Could demo transformation ideas, but client delivery requires templates, governance, and integration packs. |
| TCS | Partial for demos | Needs repeatable enterprise delivery model and strong adapter story. |
| Infosys | Partial for demos | Same blockers as TCS: integration, audit, templates, supportability. |
| Deloitte | Partial for demos | Advisory demos possible; production client deployments need controls. |
| PwC | Partial for demos | Finance/compliance client use requires stronger audit and approvals. |
| EY | Partial for demos | Governance and controls are the core gap. |
| KPMG | Partial for demos | Audit and risk workflows require immutable records and policy enforcement. |
| Uber | Not ready | Needs high-throughput event processing, idempotency, real-time monitoring. |
| Swiggy | Partial experimental | Provider manifests exist, but not Studio-grade automation. |
| Zomato | Partial experimental | Similar to Swiggy: manifests exist, runtime integration incomplete. |
| Apollo Hospitals | Not ready | Healthcare compliance, PHI protection, audit, and integrations are missing in Studio. |
| ICICI Bank | Not ready | Banking needs strict policy, approval, ledger, secrets, audit, and scale. |
| HDFC Bank | Not ready | Same banking blockers. |
| Salesforce | Not ready | Would need mature Flow-like graph semantics, metadata model, and connector ecosystem. |
| Shopify | Partial for demos | Commerce/payment pieces exist, but merchant automation connectors are missing. |

## Industry Readiness Score

Multi-industry readiness score: 38/100.

The repository shows ambition across many industries, but Studio currently needs a platform-grade automation core before those industry surfaces can be production-ready.
