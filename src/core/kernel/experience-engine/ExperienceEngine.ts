import { WorkflowManifest } from '@/core/workflow-ui';

export interface DelegationMetrics {
  workflowId: string;
  capabilityId: string;
  timeSavedMinutes: number;
  questionsAvoided: number;
  clicksAvoided: number;
  moneySaved: number;
  problemsPrevented: number;
  timestamp: number;
}

export class ExperienceEngine {
  private metricsLog: DelegationMetrics[] = [];

  recordDelegationSuccess(manifest: WorkflowManifest, workflowId: string, actualTimeMs: number) {
    if (!manifest.estimatedManualMinutes) return;

    const manualMinutes = manifest.estimatedManualMinutes || 0;
    const actualMinutes = actualTimeMs / (1000 * 60);
    const timeSavedMinutes = Math.max(0, manualMinutes - actualMinutes);

    const metrics: DelegationMetrics = {
      workflowId,
      capabilityId: manifest.id,
      timeSavedMinutes,
      questionsAvoided: manifest.expectedQuestions || 0,
      clicksAvoided: manifest.expectedClicks || 0,
      moneySaved: manifest.expectedMoneySaved || 0,
      problemsPrevented: 0,
      timestamp: Date.now()
    };

    this.metricsLog.push(metrics);
    console.log(`[ExperienceEngine] Delegation Success: Saved ${timeSavedMinutes.toFixed(1)} mins, avoided ${metrics.questionsAvoided} questions.`);
  }

  getMetricsSummary() {
    return this.metricsLog.reduce((acc, log) => {
      acc.totalTimeSavedMinutes += log.timeSavedMinutes;
      acc.totalQuestionsAvoided += log.questionsAvoided;
      acc.totalClicksAvoided += log.clicksAvoided;
      return acc;
    }, { totalTimeSavedMinutes: 0, totalQuestionsAvoided: 0, totalClicksAvoided: 0 });
  }
}

export const experienceEngine = new ExperienceEngine();
