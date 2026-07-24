import { supabase } from '@/integrations/supabase/client';
import { AgentSession, agentSessionManager } from '@/core/services/AgentSessionManager';

export type VersionLifecycle = 'draft' | 'published' | 'archived' | 'deprecated';

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  semver: string; // e.g. "1.0.0"
  version_number: number;
  nodes: any[];
  edges: any[];
  status: VersionLifecycle;
  change_summary?: string;
  published_notes?: string;
  migration_notes?: string;
  published_at?: string;
  published_by?: string;
  tenant_id?: string;
  created_by?: string;
  created_at: string;
}

class WorkflowVersionManagerImpl {
  /**
   * Creates a new Draft version of a workflow.
   * A Draft is the only mutable state. Publishing locks it forever.
   */
  async createDraft(
    workflowId: string,
    nodes: any[],
    edges: any[],
    changeSummary: string
  ): Promise<WorkflowVersion | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine next semver by reading the latest version
      const { data: latest } = await supabase
        .from('workflow_versions')
        .select('semver, version_number')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersionNumber = (latest?.version_number ?? 0) + 1;
      const nextSemver = this.incrementPatch(latest?.semver ?? '0.0.0');

      const { data, error } = await supabase
        .from('workflow_versions')
        .insert({
          workflow_id: workflowId,
          semver: nextSemver,
          version_number: nextVersionNumber,
          nodes,
          edges,
          status: 'draft',
          change_summary: changeSummary,
          created_by: user.id
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as WorkflowVersion;
    } catch (err: any) {
      console.error('[WorkflowVersionManager] createDraft failed:', err.message);
      return null;
    }
  }

  /**
   * Publishes a draft version. After this point the version is immutable.
   */
  async publish(
    versionId: string,
    publishedNotes?: string
  ): Promise<WorkflowVersion | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Mark old published version as archived
      const { data: version } = await supabase
        .from('workflow_versions')
        .select('workflow_id')
        .eq('id', versionId)
        .single();

      if (version) {
        await supabase
          .from('workflow_versions')
          .update({ status: 'archived' })
          .eq('workflow_id', version.workflow_id)
          .eq('status', 'published');
      }

      // Publish this version — immutable from this point
      const { data, error } = await supabase
        .from('workflow_versions')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user.id,
          published_notes: publishedNotes ?? null
        })
        .eq('id', versionId)
        .eq('status', 'draft') // Safety: only drafts can be published
        .select('*')
        .single();

      if (error) throw error;

      // Update the parent workflow's active_version_id
      if (data) {
        await supabase
          .from('business_workflows')
          .update({
            active_version_id: versionId,
            lifecycle_status: 'published'
          })
          .eq('id', data.workflow_id);
      }

      return data as WorkflowVersion;
    } catch (err: any) {
      console.error('[WorkflowVersionManager] publish failed:', err.message);
      return null;
    }
  }

  async getPublishedVersion(workflowId: string): Promise<WorkflowVersion | null> {
    const { data, error } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('status', 'published')
      .single();

    if (error) return null;
    return data as WorkflowVersion;
  }

  private incrementPatch(semver: string): string {
    const parts = semver.split('.').map(Number);
    if (parts.length !== 3) return '1.0.0';
    parts[2]++;
    return parts.join('.');
  }
}

export const WorkflowVersionManager = new WorkflowVersionManagerImpl();
