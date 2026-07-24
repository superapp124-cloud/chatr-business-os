# CHATR Conversation API

The Conversation API is the universal intelligence and orchestration layer for the CHATR ecosystem.

## Design Principles
1. **Platform-Agnostic**: Web, Desktop, and Mobile clients connect via identical endpoints.
2. **Streaming-First**: Token-by-token response streaming using SSE.
3. **Provider Abstraction**: Backend routes via `IAIProvider` to `OllamaProvider` (local) or cloud models based on `ai_settings`.
4. **Context Building**: Dynamically retrieves summary, recent messages, organization context, and vector memory *before* hitting the LLM.

## Core Endpoints
- `POST /api/v1/conversation/chat` (Standard sync chat)
- `POST /api/v1/conversation/stream` (Primary SSE streaming endpoint)
- `POST /api/v1/conversation/tools` (Execute tools)
- `POST /api/v1/conversation/memory` (Manage intelligence vectors)

## The Context Builder Pipeline
1. Identifies the Active User & Device Context.
2. Retrieves `conversation_summaries` (latest rollup).
3. Appends recent unsummarized `messages`.
4. Injects relevant `ai_memory` chunks.
5. Attaches `ai_settings` tool capabilities.
6. Packages into the `IAIProvider` prompt format.
