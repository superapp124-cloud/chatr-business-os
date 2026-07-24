type EventCallback = (payload: any) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event
   * @param event The event name to subscribe to
   * @param callback The function to execute when the event is emitted
   * @returns A function to unsubscribe from the event
   */
  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(event, callback);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event The event name
   * @param callback The callback to remove
   */
  unsubscribe(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event
   * @param event The event name
   * @param payload The data to pass to the callbacks
   */
  emit(event: string, payload?: any): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      // Copy the set before iterating to prevent issues if a callback unsubscribes during iteration
      Array.from(callbacks).forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Clear all listeners for a specific event or all events
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Global singleton instance
export const systemEventBus = new EventBus();

// Standardize Event Names
export const BusinessEvents = {
  CUSTOMER_CREATED: 'business:customer_created',
  CUSTOMER_UPDATED: 'business:customer_updated',
  INVOICE_PAID: 'business:invoice_paid',
  WORKFLOW_TRIGGERED: 'business:workflow_triggered',
  CALL_RECEIVED: 'business:call_received',
  CALL_MISSED: 'business:call_missed',
  MESSAGE_RECEIVED: 'business:message_received',
} as const;
