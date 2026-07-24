/**
 * CHATR OS — Action Brain
 * 
 * Part of the Universal Executive Runtime.
 * Orchestrates workflows, DAGs, and state changes for 'Act' intents.
 */
import { GoalPlanner, IExecutionGraph } from './GoalPlanner';
import { ExecutionRuntime } from './ExecutionRuntime';
import { IBusinessContext } from './ContextRuntime';

export class ActionBrain {
  
  static async execute(context: IBusinessContext): Promise<any> {
    try {
      const plan: IExecutionGraph = GoalPlanner.createPlan(context);
      const result = await ExecutionRuntime.execute(plan);
      
      return {
        success: result.success,
        data: result.outputs['node_store'] || result.outputs,
        logs: result.logs
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        data: null
      };
    }
  }
}
