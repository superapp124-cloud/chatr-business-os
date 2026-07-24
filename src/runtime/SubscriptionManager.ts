import { supabase } from '@/integrations/supabase/client';
import { ExecutionContext } from '@/kernel/ExecutionContext';
import { EventBus } from '@/kernel/EventBus';
import { Logger } from './Logger';

export class SubscriptionManagerService {
  private activeSubscriptions: Map<string, any> = new Map();

  /**
   * Optimizes WebSocket usage by only subscribing to what is currently visible 
   * or executing.
   */
  subscribeToEntity(entityName: string, tableName: string, context: ExecutionContext) {
    const subKey = `entity:${entityName}`;
    
    if (this.activeSubscriptions.has(subKey)) {
      return; // Already subscribed
    }

    const channel = supabase.channel(`public:${tableName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, payload => {
        Logger.debug(`Realtime update received for ${tableName}`, context, payload);
        
        // Publish into the local OS event bus so the UI can react optimistically
        EventBus.publish(`Realtime.${entityName}.Changed`, payload, context);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          Logger.info(`Subscribed to realtime updates for ${entityName}`, context);
        }
      });

    this.activeSubscriptions.set(subKey, channel);
  }

  unsubscribeFromEntity(entityName: string) {
    const subKey = `entity:${entityName}`;
    const channel = this.activeSubscriptions.get(subKey);
    
    if (channel) {
      supabase.removeChannel(channel);
      this.activeSubscriptions.delete(subKey);
      Logger.debug(`Unsubscribed from ${entityName}`);
    }
  }

  unsubscribeAll() {
    this.activeSubscriptions.forEach((channel) => supabase.removeChannel(channel));
    this.activeSubscriptions.clear();
  }
}

export const SubscriptionManager = new SubscriptionManagerService();
