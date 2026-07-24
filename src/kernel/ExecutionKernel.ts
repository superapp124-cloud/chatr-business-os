import { IntentResolver } from './IntentResolver';
import { CapabilityRegistry } from './CapabilityRegistry';
import { PolicyEngine } from './PolicyEngine';
import { PermissionEngine } from './PermissionEngine';
import { SandboxManager } from './SandboxManager';
import { EventBus } from './EventBus';
import { ExecutionContext } from './ExecutionContext';
import { Observability } from '@/runtime/Observability';
import { Logger } from '@/runtime/Logger';

export class ExecutionKernel {
  /**
   * The Strict Runtime Pipeline.
   * Every capability passes through this kernel exactly once.
   */
  static async execute(input: string | any, context: ExecutionContext): Promise<any> {
    const trace = Observability.startTrace('kernel.execute', context);
    
    try {
      // 1. Resolve Intent
      const intent = await IntentResolver.resolve(input, context);
      Logger.debug(`Intent resolved: ${intent.action}`, context);

      const requestedProvider = input.preferredProvider || 'default';
      
      // 2. Evaluate Policy (Under what conditions is this allowed?)
      const policyDecision = await PolicyEngine.evaluateCapabilityPolicy(
        context.tenant.organizationId,
        intent.capabilityType,
        requestedProvider
      );

      if (!policyDecision.allowed) {
        Logger.audit('Policy Denied', context, { intent, reason: policyDecision.reason });
        EventBus.publish('Kernel.PolicyDenied', { intent, reason: policyDecision.reason }, context);
        throw new Error(`Policy Denied: ${policyDecision.reason}`);
      }

      // 3. Permission Engine (Who is allowed to do this?)
      const isAuthorized = await PermissionEngine.authorize(intent, context);
      if (!isAuthorized) {
        throw new Error(`Permission Denied: User is not authorized to execute ${intent.action}`);
      }

      // 4. Capability Resolver
      const providerId = policyDecision.providerToUse || requestedProvider;
      const capability = CapabilityRegistry.getProvider(intent.capabilityType, providerId) 
        || CapabilityRegistry.getProviders(intent.capabilityType)[0];

      if (!capability && !providerId.startsWith('plugin_')) {
        throw new Error(`No provider registered for capability: ${intent.capabilityType}`);
      }

      // 5. Execution Engine (Sandbox check)
      EventBus.publish('Kernel.ExecutionStarted', { intent, providerId }, context);
      
      let result;
      if (providerId.startsWith('plugin_')) {
        // Run safely in isolated environment
        result = await SandboxManager.executeInSandbox(providerId, intent, context);
      } else {
        // Run natively
        result = await capability.execute(intent.payload, context);
      }
      
      // 6. Return Result
      EventBus.publish('Kernel.ExecutionCompleted', { intent, providerId }, context);
      Logger.info(`Execution completed for ${intent.action}`, context);
      
      return result;

    } catch (error: any) {
      Logger.error(`Execution failed`, error, context);
      EventBus.publish('Kernel.ExecutionFailed', { input, error: error.message }, context);
      throw error;
    } finally {
      trace.end();
    }
  }
}
