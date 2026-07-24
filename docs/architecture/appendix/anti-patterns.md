# Anti-Patterns

This document logs the architectural anti-patterns that must be actively avoided. Reviewing this list is mandatory before merging significant architectural changes. Future contributors will thank you.

## ❌ 1. Don't put business logic inside React.
**Why it's bad:** React is the presentation layer. If a rule like "Invoices over $5k require approval" is written in `InvoiceView.tsx`, Studio cannot read it, the AI cannot reason about it, and it cannot be executed headlessly.
**Do this instead:** Define the rule in the `Policy Engine` metadata. React simply renders the state of the object.

## ❌ 2. Don't hardcode departments.
**Why it's bad:** A switch statement checking `if (dept === 'Finance')` destroys extensibility. It means every new department requires a code change.
**Do this instead:** Rely on the `Semantic Engine` and `Identity Engine`. If a department has a unique requirement, model it as an EDL capability constraint.

## ❌ 3. Don't create module-specific databases.
**Why it's bad:** Creating a separate SQLite database or distinct backend service for "Recruitment" fractures the Enterprise Knowledge Graph.
**Do this instead:** All objects are stored in the `Living Object Runtime` and connected via the `Relationship Engine`. A recruitment candidate is just a node in the universal graph.

## ❌ 4. Don't let LLMs mutate state directly.
**Why it's bad:** LLMs hallucinate. If the LLM generates a SQL `UPDATE` statement, it bypasses permissions, audit logs, and business rules.
**Do this instead:** The LLM uses the `Intelligence Engine` to resolve an *Intent*. That intent is passed to the `Process Engine`, which verifies policies and executes the change deterministically.

## ❌ 5. Don't create special-case workflows.
**Why it's bad:** Hardcoding a bespoke "Employee Onboarding Workflow Engine" alongside a "Sales Pipeline Engine" duplicates effort and fragments the system.
**Do this instead:** Both onboarding and pipelines are DAGs executed by the universal `Process Engine`. Everything is executable via the same runtime.

## ❌ 6. Don't duplicate metadata.
**Why it's bad:** If a form defines `Field: Salary (Number)` and the database defines `Column: Salary (Varchar)`, the system will crash.
**Do this instead:** The Enterprise Definition Language (EDL) is the single source of truth. Forms and database schemas are *projections* of the CDL/EDL.

## ❌ 7. Don't bypass the Event Engine.
**Why it's bad:** Updating an object silently (`object.status = 'Approved'`) breaks the audit trail, breaks time-travel, and prevents automations from triggering.
**Do this instead:** Emit an event (`ObjectApprovedEvent`). The `Event Engine` receives it, updates the projection (the current state), and triggers any listening automations.
