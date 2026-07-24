# CHATR Database Contract v1

This document defines the strict, normalized schema for CHATR's backend.

## Communication Core
- **`conversations`**: Container for messaging.
- **`conversation_participants`**: Maps users to chats and tracks `last_read_at`.
- **`messages`**: Unified history. `type` dictates if it's `text`, `ai`, `system`, or `tool`. Supports `version`, `metadata`, `edited_at`, `deleted_at`.
- **`message_reactions`**: Normalized emoji reactions (replaces JSON arrays).
- **`message_receipts`**: Normalized delivery and read receipts per message.
- **`attachments`**: Normalized file metadata (thumbnails, dimensions, checksums) linked via `message_id`.

## AI Intelligence
- **`ai_settings`**: Organization-level AI provider configs (model, temp, tools enabled).
- **`ai_sessions`**: Tracks metadata for AI responses within unified messages.
- **`ai_tools`**: Tracks tool execution metrics (latency, payload, errors).
- **`ai_memory`**: Long-term intelligence (scope, confidence, expires_at).
- **`conversation_summaries`**: Periodic rollup of long conversations to compress context windows.

## Infrastructure
- **`notifications`**: System alerts.
- **`storage_metadata`**: Storage tracking.
- **`audit_logs`**: Immutable ledger of privileged operations.
