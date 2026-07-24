/**
 * CHATR Kernel Runtime v2.0 — CommandBus
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Commands are REQUESTS (can be rejected, can be undone).
 * Events are FACTS (already happened, cannot be undone).
 *
 * Flow:
 *   User/Engine → dispatch(Command) → CommandHandler → CommandResult
 *   → on success: handler emits Events via EventBus
 *   → on failure: returns { success: false, error }
 *
 * Undo:
 *   Every command may register a rollback() function.
 *   CommandBus.undo(correlationId) calls it.
 *
 * Tracing:
 *   Every command gets a correlationId. All resulting events include it.
 *   This enables full trace: command → events → notifications.
 */

import { CHATRCommand, CommandHandler, CommandResult } from './types';
import { eventBus, EVENTS } from './EventBus';

class CommandBusImpl {
  private handlers = new Map<string, CommandHandler<unknown, unknown>>();
  private rollbackStore = new Map<string, () => Promise<void>>();
  private history: Array<{ id: string; type: string; timestamp: number }> = [];

  // ── Register handler ───────────────────────────────────────────────────────

  register<TPayload = unknown, TResult = unknown>(
    type: string,
    handler: CommandHandler<TPayload, TResult>
  ): () => void {
    if (this.handlers.has(type)) {
      console.warn(`[CommandBus] Handler already registered for "${type}". Overwriting.`);
    }
    this.handlers.set(type, handler as CommandHandler<unknown, unknown>);
    return () => this.handlers.delete(type);
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  async dispatch<TPayload = unknown, TResult = unknown>(
    type: string,
    payload: TPayload,
    opts?: {
      requestedBy?: string;
      rollback?: () => Promise<void>;
    }
  ): Promise<CommandResult<TResult>> {
    const command: CHATRCommand<TPayload> = {
      id: crypto.randomUUID(),
      type,
      payload,
      requestedBy: opts?.requestedBy ?? 'user',
      timestamp: Date.now(),
    };

    const handler = this.handlers.get(type);
    if (!handler) {
      console.error(`[CommandBus] No handler registered for "${type}"`);
      return { success: false, error: `No handler for command "${type}"`, correlationId: command.id };
    }

    let result: CommandResult<TResult>;
    try {
      result = await handler(command) as CommandResult<TResult>;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[CommandBus] Handler threw for "${type}":`, err);
      result = { success: false, error, correlationId: command.id };
    }

    // Store rollback if provided and command succeeded
    if (result.success && opts?.rollback) {
      this.rollbackStore.set(command.id, opts.rollback);
    }

    // Track history (keep last 100)
    this.history.push({ id: command.id, type, timestamp: command.timestamp });
    if (this.history.length > 100) this.history.shift();

    return result;
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  async undo(correlationId: string): Promise<boolean> {
    const rollback = this.rollbackStore.get(correlationId);
    if (!rollback) {
      console.warn(`[CommandBus] No rollback registered for "${correlationId}"`);
      return false;
    }
    try {
      await rollback();
      this.rollbackStore.delete(correlationId);
      return true;
    } catch (err) {
      console.error(`[CommandBus] Rollback failed for "${correlationId}":`, err);
      return false;
    }
  }

  // ── Commands catalog ──────────────────────────────────────────────────────

  get registeredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  get commandHistory() {
    return [...this.history];
  }

  reset(): void {
    this.handlers.clear();
    this.rollbackStore.clear();
    this.history = [];
  }
}

// ─── Known command types ──────────────────────────────────────────────────────

export const COMMANDS = {
  CREATE_TASK:       'CREATE_TASK',
  CREATE_REMINDER:   'CREATE_REMINDER',
  CREATE_MEETING:    'CREATE_MEETING',
  CREATE_NOTE:       'CREATE_NOTE',
  SEND_EMAIL:        'SEND_EMAIL',
  MAKE_CALL:         'MAKE_CALL',
  SCHEDULE_EVENT:    'SCHEDULE_EVENT',
  CREATE_CONTACT:    'CREATE_CONTACT',
  UPDATE_CONTACT:    'UPDATE_CONTACT',
  UPLOAD_DOCUMENT:   'UPLOAD_DOCUMENT',
  CHANGE_WORKSPACE:  'CHANGE_WORKSPACE',
  EXECUTE_WORKFLOW:  'EXECUTE_WORKFLOW',
  INSTALL_PLUGIN:    'INSTALL_PLUGIN',
  ENABLE_PLUGIN:     'ENABLE_PLUGIN',
  DISABLE_PLUGIN:    'DISABLE_PLUGIN',
  SEARCH_UNIVERSAL:  'SEARCH_UNIVERSAL',
  CREATE_EXPENSE:    'CREATE_EXPENSE',
  BOOK_FLIGHT:       'BOOK_FLIGHT',
  BOOK_HOTEL:        'BOOK_HOTEL',
} as const;

export const commandBus = new CommandBusImpl();
export type { CommandBusImpl };
