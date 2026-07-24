# CHATR Core v1.0 API Compatibility Contract

This document freezes the public interfaces of CHATR Core for v1.0. 
Any change to these interfaces requires an explicit Architectural Decision Record (ADR) and a major version bump. All future capabilities and platform extensions must adhere to these interfaces.

## 1. Conversation SDK (`kernel-sdk/index.cjs`)
Capabilities must use the SDK; they are strictly forbidden from importing Kernel transport layers directly.
- `capability(name: string): CapabilityInstance`
- `CapabilityInstance.observe(handler: (payload, envelope) => void)`
- `CapabilityInstance.resolve(handler: (payload, envelope) => void)`
- `CapabilityInstance.publishEntities(understandingId, entities, correlationId)`
- `CapabilityInstance.requestAction(understandingId, actionDef, correlationId)`
- `CapabilityInstance.execute(handler: (action, envelope) => void)`
- `CapabilityInstance.journal(action, status, correlationId, conversationId)`
- `CapabilityInstance.learn(handler: (payload, envelope) => void)`

## 2. Kernel Events
Event routing is governed strictly by this lifecycle:
- `KERNEL.INPUT.RECEIVED`
- `KERNEL.OBSERVATION.CREATED`
- `KERNEL.UNDERSTANDING.CREATED`
- `KERNEL.CONTEXT.RESOLVED`
- `KERNEL.ENTITY.RESOLVED`
- `KERNEL.ACTION.REVEALED`
- `KERNEL.ACTION.CONFIRMED`
- `KERNEL.ACTION.EXECUTED`
- `KERNEL.JOURNAL.APPENDED`
- `KERNEL.LEARNING.COMPLETE`

## 3. Canonical Objects
All payloads traversing the Event Bus must comply with these base schemas:
- **Understanding**: `{ id, type, source, temporalState, confidence, entities, policy }`
- **ContextAnchor**: `{ id, type, entities, source, timestamp, conversationId, workspace, confidence }`
- **ActionEnvelope**: `{ type, summary, contextRef, entities, linkedContext }`

## 4. Persistence Interface
Data storage must be fully decoupled from fs/JSON to allow seamless transition to SQLite/Enterprise stores.
- `store(collection: string, data: object)`
- `retrieve(collection: string, query: object)`
- `append(collection: string, entry: object)`
- `flush(collection: string)`

## 5. Module Interface (`module-interface.cjs`)
Custom modules (non-capability) interacting with the HTTP/Event layers:
- `observe(payload)`
- `evaluate(payload, context)`
- `execute(payload)`

## 6. Provider Interface
External LLM/SLM/Vector capabilities must implement:
- `generate(prompt, config)`
- `embed(text, config)`
- `status()`

No feature branch may be merged if it violates this compatibility contract.
