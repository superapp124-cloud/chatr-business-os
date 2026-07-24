# ADR-005: Understanding Horizon

## Status
Accepted

## Reason
Users historically viewed AI features as "chatbots" requiring explicit conversational interaction. We needed an interaction pattern that made the semantic processing feel ambient, progressive, and native.

## Decision
We implemented the `Understanding Horizon`. It is a dedicated, reserved spatial layer in the UI that expands smoothly to reveal extracted Entities (Who, When, Where) as they are resolved in real-time. 

## Consequences
- **Pros:** It eliminates the "chat" paradigm. Users see the machine forming a structured understanding of their unstructured text instantly. It builds deep product trust through complete transparency.
- **Cons:** It requires strict adherence to sub-100ms Performance Budgets across the Observation and Understanding stages, otherwise the animation feels sluggish or reactive rather than ambient.
