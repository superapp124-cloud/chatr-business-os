import { AsyncLocalStorage } from 'async_hooks';
import { ExecutionContext } from '../../types.js';

export class TenantContextManager {
  private static als = new AsyncLocalStorage<ExecutionContext>();

  /**
   * Run a function within a specific ExecutionContext.
   * This binds the tenant and execution context to the async boundary.
   */
  static runWithinContext<T>(context: ExecutionContext, fn: () => T | Promise<T>): T | Promise<T> {
    return this.als.run(context, fn);
  }

  /**
   * Retrieve the current ExecutionContext from the async boundary.
   * Returns undefined if called outside a wrapped boundary.
   */
  static getContext(): ExecutionContext | undefined {
    return this.als.getStore();
  }

  /**
   * Enforces that an ExecutionContext exists. Throws an error if not found.
   */
  static getContextOrThrow(): ExecutionContext {
    const context = this.getContext();
    if (!context) {
      throw new Error('No ExecutionContext found in the current async boundary.');
    }
    return context;
  }
}
