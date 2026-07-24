/**
 * Certification History — Append-Only Record
 *
 * Certifications are never overwritten. Every run appends a new record.
 * This enables regression investigation across provider versions.
 *
 * Storage: localStorage (pre-Supabase) → will migrate to SupabaseStateStore in v1.1B.
 */
import { CertificationArtifact } from './IntegrationScorecard';

/**
 * Provider Lifecycle:
 *   development → certification → production_qualification → ga
 *
 * certification:              Passes all technical gates. Not yet run under real load.
 * production_qualification:   Running in controlled production (internal use). Monitoring active.
 * ga:                         Default supported provider. Broadly deployed.
 *
 * A newly certified provider must spend time in production_qualification before GA.
 * This prevents immediately promoting a technically-correct-but-operationally-unproven provider.
 */
export type ProviderLifecycleStage =
  | 'development'
  | 'certification'
  | 'production_qualification'
  | 'ga';

export interface CertificationRecord extends CertificationArtifact {
  runId: string;
  contractVersion: string;
  lifecycleStage: ProviderLifecycleStage;
  releaseApproved: boolean;
  releaseApprovedBy?: string;
  releaseApprovedAt?: string;
  releaseNotes?: string;
}

const STORAGE_KEY = 'chatr:certification_history';

export class CertificationHistory {

  static append(
    artifact: CertificationArtifact,
    contractVersion: string,
    initialStage: ProviderLifecycleStage = 'certification'
  ): CertificationRecord {
    const record: CertificationRecord = {
      ...artifact,
      runId: crypto.randomUUID(),
      contractVersion,
      lifecycleStage: artifact.verdict === 'CERTIFIED' ? initialStage : 'development',
      releaseApproved: false,
    };

    const all = this.loadAll();
    all.push(record);
    this.persist(all);

    console.log(
      `[CertificationHistory] Appended ${artifact.provider} ${artifact.version}` +
      ` → lifecycle: ${record.lifecycleStage} | runId: ${record.runId}`
    );
    return record;
  }

  /**
   * Advance a provider’s lifecycle stage.
   * development → certification → production_qualification → ga
   *
   * production_qualification requires human approval.
   * ga requires evidence from production_qualification (cannot jump from certification).
   */
  static promoteLifecycle(
    runId: string,
    targetStage: Exclude<ProviderLifecycleStage, 'development'>,
    promotedBy: string
  ): boolean {
    const all = this.loadAll();
    const record = all.find(r => r.runId === runId);
    if (!record) {
      console.warn(`[CertificationHistory] runId not found: ${runId}`);
      return false;
    }
    if (record.verdict !== 'CERTIFIED') {
      console.error(`[CertificationHistory] Cannot promote a non-certified provider.`);
      return false;
    }
    const order: ProviderLifecycleStage[] = ['development', 'certification', 'production_qualification', 'ga'];
    const currentIdx = order.indexOf(record.lifecycleStage);
    const targetIdx  = order.indexOf(targetStage);
    if (targetIdx !== currentIdx + 1) {
      console.error(
        `[CertificationHistory] Invalid stage transition: ${record.lifecycleStage} → ${targetStage}. ` +
        `Must advance one stage at a time.`
      );
      return false;
    }
    record.lifecycleStage = targetStage;
    this.persist(all);
    console.log(
      `[CertificationHistory] ✅ ${record.provider} ${record.version} promoted to` +
      ` '${targetStage}' by ${promotedBy}`
    );
    return true;
  }

  /**
   * Mark a specific certification run as release-approved.
   * This is the formal governance checkpoint before promoting to production.
   */
  static approve(runId: string, approvedBy: string, notes?: string): boolean {
    const all = this.loadAll();
    const record = all.find(r => r.runId === runId);
    if (!record) {
      console.warn(`[CertificationHistory] runId not found: ${runId}`);
      return false;
    }

    if (record.verdict !== 'CERTIFIED') {
      console.error(`[CertificationHistory] Cannot approve a non-certified run (verdict: ${record.verdict})`);
      return false;
    }

    record.releaseApproved = true;
    record.releaseApprovedBy = approvedBy;
    record.releaseApprovedAt = new Date().toISOString();
    record.releaseNotes = notes;
    this.persist(all);

    console.log(`[CertificationHistory] ✅ Release approved for ${record.provider} ${record.version} by ${approvedBy}`);
    return true;
  }

  /** Get full history for a specific provider (all versions, all runs). */
  static getHistory(provider: string): CertificationRecord[] {
    return this.loadAll()
      .filter(r => r.provider === provider)
      .sort((a, b) => new Date(a.certificationDate).getTime() - new Date(b.certificationDate).getTime());
  }

  /** Get the latest certified+approved record for a provider. */
  static getLastApproved(provider: string): CertificationRecord | null {
    const approved = this.loadAll()
      .filter(r => r.provider === provider && r.releaseApproved && r.verdict === 'CERTIFIED')
      .sort((a, b) => new Date(b.releaseApprovedAt!).getTime() - new Date(a.releaseApprovedAt!).getTime());
    return approved[0] ?? null;
  }

  /** Print the certification history for a provider in a human-readable table. */
  static printHistory(provider: string): void {
    const history = this.getHistory(provider);
    console.log(`\n  Certification History — ${provider}`);
    console.log('  ┌───────────────────────┬──────────┬──────────┬──────────────┬──────────────────────────┐');
    console.log('  │ RunId (short)         │ Version  │ Contract │ Verdict      │ Lifecycle Stage          │');
    console.log('  ├───────────────────────┼──────────┼──────────┼──────────────┼──────────────────────────┤');
    for (const r of history) {
      const id      = r.runId.slice(0, 21).padEnd(21);
      const ver     = r.version.padEnd(8);
      const contract = r.contractVersion.padEnd(8);
      const verdict  = r.verdict.padEnd(12);
      const stage    = r.lifecycleStage.padEnd(24);
      console.log(`  │ ${id} │ ${ver} │ ${contract} │ ${verdict} │ ${stage} │`);
    }
    console.log('  └───────────────────────┴──────────┴──────────┴──────────────┴──────────────────────────┘');
  }

  private static loadAll(): CertificationRecord[] {
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private static persist(records: CertificationRecord[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }
    } catch (e) {
      console.warn('[CertificationHistory] Could not persist history:', e);
    }
  }
}
