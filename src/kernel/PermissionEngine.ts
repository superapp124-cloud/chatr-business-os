import { ExecutionContext } from './ExecutionContext';
import { ParsedIntent } from './IntentResolver';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/runtime/Logger';

export class PermissionEngine {
  /**
   * Authorizes business actions (Intents), not just CRUD operations.
   */
  static async authorize(intent: ParsedIntent, context: ExecutionContext): Promise<boolean> {
    // Determine the required permission based on the Intent Action
    const requiredPermission = `${intent.capabilityType}:${intent.action}`;

    try {
      // In an OS, permissions are cached in the context or fetched from sys_permissions
      // We will check the context first
      if (context.permissions && context.permissions[requiredPermission] !== undefined) {
        return context.permissions[requiredPermission];
      }

      // Fallback: Check the database for the user's role on this capability/action
      const { data, error } = await supabase
        .from('sys_permissions')
        .select('*')
        .eq('target_type', 'capability')
        .eq('target_id', intent.capabilityType) // Assuming target_id can hold capability string for this check
        .eq('role', context.user.role)
        .single();

      if (error || !data) {
        Logger.audit('Permission Denied', context, { intent: requiredPermission, reason: 'No policy found' });
        return false;
      }

      // Evaluate permissions_json to see if action is allowed
      const isAllowed = (data.permissions_json as any)[intent.action] === true;
      
      if (!isAllowed) {
        Logger.audit('Permission Denied', context, { intent: requiredPermission, reason: 'Explicitly denied in JSON' });
      }

      return isAllowed;

    } catch (e) {
      Logger.error('Error during permission authorization', e as Error, context);
      return false;
    }
  }
}
