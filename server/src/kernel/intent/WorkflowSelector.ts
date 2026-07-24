import { ICapabilityPackage, ICapabilityWorkflow } from '../../types.js';

export class WorkflowSelector {
  /**
   * Deterministically selects the best workflow from a capability package
   * for a given action string.  The CapabilitySearch already narrowed down
   * to the right package; this step picks the right workflow inside it.
   *
   * Strategy (in priority order):
   *  1. Exact suffix match:  "CreateLead"  →  "Sales.CreateLead"
   *  2. Contains match:      "create"      →  first wf whose suffix contains the action
   *  3. Fallback:            first workflow in the package
   */
  static select(pkg: ICapabilityPackage, action: string): ICapabilityWorkflow | null {
    const actionLower = action.toLowerCase();

    // 1. Exact suffix match
    const exact = pkg.workflows.find(wf => {
      const suffix = wf.id.split('.').pop()?.toLowerCase() ?? '';
      return suffix === actionLower;
    });
    if (exact) return exact;

    // 2. Contains match (both directions)
    const contains = pkg.workflows.find(wf => {
      const suffix = wf.id.split('.').pop()?.toLowerCase() ?? '';
      return suffix.includes(actionLower) || actionLower.includes(suffix);
    });
    if (contains) return contains;

    // 3. Fallback to first workflow
    return pkg.workflows[0] ?? null;
  }
}
