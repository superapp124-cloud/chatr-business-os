# CHATR Architecture

## Core Vision
CHATR is an AI-first, privacy-first collaboration platform. It unifies messaging, video calls, enterprise storage, and autonomous agents under a single scalable foundation.

## Strict Layering
To guarantee modularity, we enforce the following separation of concerns:
1. **React UI (Web, Desktop, Mobile)**: Dumb views that only render state.
2. **Conversation SDK**: Typed frontend SDK for real-time syncing.
3. **Conversation API**: The universal intelligence layer.
4. **Services**: Domain logic (Storage, Notifications, Billing).
5. **Repositories**: Data access layer.
6. **Supabase**: PostgreSQL database and Auth.

> **CRITICAL**: The UI must *never* communicate directly with Ollama, Supabase Storage directly (bypassing signed URLs), or internal database logic.

## AI Orchestration
AI is not a side feature; the **Conversation API** is the AI Operating System for CHATR.
It orchestrates:
- Streaming AI responses via Server-Sent Events (SSE).
- Dynamic Context Building (Memory, Summaries, Workspace Context).
- Abstracted `IAIProvider` execution (Ollama, OpenAI, Enterprise).
- Tool execution orchestration (Calendar, File Search).

## Storage Strategy
- All attachments are stored in a **private bucket** (`chat_attachments`).
- Access is granted *strictly* via short-lived signed URLs.
- Background jobs handle checksum generation, thumbnail processing, and virus scanning.
