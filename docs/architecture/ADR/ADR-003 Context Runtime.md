# ADR-003: Context Runtime

## Status
Accepted

## Reason
The original approach to context merely retrieved the last N chat messages. This was insufficient for an "operating system" paradigm where users jump between meetings, tasks, and documents. We needed a way to resolve complex pronoun references (e.g., "Move it to Friday") against a living, non-linear context.

## Decision
We implemented a dedicated `Context Runtime` in the Kernel. It scores and arbitrates active contexts across the workspace using a weighted algorithm:
- Scope Match (40 pts)
- Semantic Similarity (30 pts)
- Recency (20 pts)
- User Focus (10 pts)

## Consequences
- **Pros:** Unprecedented context continuity. Users can seamlessly append to or modify tasks/meetings over time without repeating prior constraints.
- **Cons:** High complexity in the scoring algorithm. If confidence is low, the system must degrade gracefully (fallback to asking the user) to avoid "Inventing Reality" (Kernel Law 2).
