export class PlannerConfidence {
  /**
   * Computes the final Planner Confidence Score based on hard gates.
   * Intent (35%), Capability (30%), Workflow (25%), Entity extraction (10%).
   */
  static compute(intentScore: number, capabilityScore: number, workflowScore: number, entityScore: number): number {
    const score = (intentScore * 0.35) + (capabilityScore * 0.30) + (workflowScore * 0.25) + (entityScore * 0.10);
    
    // Hard Gates: A high entity score shouldn't mask a bad capability match
    if (capabilityScore < 0.6) {
      return Math.min(score, 0.6);
    }
    
    if (workflowScore < 0.6) {
      return Math.min(score, 0.6);
    }

    return score;
  }
}
