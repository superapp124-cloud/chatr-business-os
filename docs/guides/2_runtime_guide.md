# Runtime Guide

## 1. Pipeline Engine (Workflow Runtime)
- Owns the DAG (Directed Acyclic Graph).
- Hydrates state from checkpoints.
- Does NOT execute code. Publishes independent `ITask` jobs to the Task Runtime.

## 2. Task Runtime (Execution Runtime)
- Consumes the generic `Ready Stage Queue`.
- Employs a bounded worker pool based on `hardwareConcurrency`.
- Dynamically scales down based on `MEMORY_WARNING` events.

## 3. Event Runtime
- Replaces the synchronous EventBus.
- Implements `Delivery Queue`, `Batch Writer`, `Subscriber Manager`, and `Dead Letter Queue (DLQ)`.
- Follows the principle: "Subscribers receive events immediately; Persistence happens independently in the background."

## 4. AI Runtime
- Implements a generic `Provider Adapter` pattern.
- Caches responses via an LRU cache.
- Defaults to BYOAI/Local execution (Ollama) and degrades gracefully if no network provider is available.
