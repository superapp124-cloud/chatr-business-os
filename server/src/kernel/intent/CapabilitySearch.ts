import { CapabilityRuntime } from '../CapabilityRuntime.js';
import { ICapabilityPackage, ICapabilityWorkflow } from '../../types.js';

export interface CapabilitySearchResult {
  pkg: ICapabilityPackage;
  workflow: ICapabilityWorkflow;
  matchScore: number;
}

export class CapabilitySearch {
  /**
   * Deterministically searches the CapabilityRegistry for the best-matching
   * capability AND workflow for a given action string (e.g. "CreateLead").
   * Returns the package and workflow together so the caller doesn't need a second lookup.
   *
   * Strategy (in priority order):
   *  1. Exact workflow.id suffix match   — "CreateLead" matches "Sales.CreateLead"
   *  2. Verb+noun match against manifest — "create" + "lead" found in verbs+nouns
   *  3. Noun-only match                  — lowest-confidence fallback
   */
  static search(action: string): CapabilitySearchResult | null {
    const packages = CapabilityRuntime.getAllPackages();
    const actionLower = action.toLowerCase();

    // Pass 1: exact workflow id suffix match (most specific)
    for (const pkg of packages) {
      for (const wf of pkg.workflows) {
        const suffix = wf.id.split('.').pop()?.toLowerCase() ?? '';
        if (suffix === actionLower) {
          return { pkg, workflow: wf, matchScore: 1.0 };
        }
      }
    }

    // Pass 2: verb + noun both present in action string
    for (const pkg of packages) {
      const verbMatch = pkg.manifest.verbs.some(v => actionLower.includes(v.toLowerCase()));
      const nounMatch = pkg.manifest.nouns.some(n => actionLower.includes(n.toLowerCase()));
      if (verbMatch && nounMatch) {
        // Pick the most relevant workflow by noun presence in the action
        const wf = pkg.workflows.find(w => {
          const wfSuffix = w.id.split('.').pop()?.toLowerCase() ?? '';
          return actionLower.includes(wfSuffix) || wfSuffix.includes(actionLower);
        }) ?? pkg.workflows[0];
        if (wf) return { pkg, workflow: wf, matchScore: 0.85 };
      }
    }

    // Pass 3: noun-only fallback
    for (const pkg of packages) {
      const nounMatch = pkg.manifest.nouns.some(n => actionLower.includes(n.toLowerCase()));
      if (nounMatch) {
        const wf = pkg.workflows[0];
        if (wf) return { pkg, workflow: wf, matchScore: 0.65 };
      }
    }

    return null;
  }
}
