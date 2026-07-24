import { supabase } from '@/integrations/supabase/client';
import type { IVersionRepository } from './IVersionRepository';
import type { WorkflowManifest } from '../contracts/WorkflowManifest.abi';

export class SupabaseVersionRepository implements IVersionRepository {
  async insert(manifest: WorkflowManifest): Promise<void> {
    const { error } = await supabase.from('workflow_versions').insert({
      id: manifest.versionId,
      workflow_id: manifest.workflowId,
      version_number: manifest.versionNumber,
      semver: manifest.semver,
      manifest: manifest,
      graph_checksum: manifest.graphChecksum,
      status: manifest.status,
      published_at: manifest.publishedAt,
      published_by: manifest.publishedBy
    });
    
    if (error) throw new Error(`Failed to insert version: ${error.message}`);
  }

  async getById(versionId: string): Promise<WorkflowManifest | null> {
    const { data, error } = await supabase
      .from('workflow_versions')
      .select('manifest')
      .eq('id', versionId)
      .single();
      
    if (error || !data) return null;
    return data.manifest as WorkflowManifest;
  }

  async list(workflowId: string): Promise<WorkflowManifest[]> {
    const { data, error } = await supabase
      .from('workflow_versions')
      .select('manifest')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false });
      
    if (error || !data) return [];
    return data.map(d => d.manifest as WorkflowManifest);
  }

  async getLatestVersionNumber(workflowId: string): Promise<number> {
    const { data, error } = await supabase
      .from('workflow_versions')
      .select('version_number')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
      
    // If no versions exist yet, start at 0 (so the first one is 1)
    if (error || !data) return 0;
    return data.version_number;
  }

  async getActive(workflowId: string): Promise<WorkflowManifest | null> {
    const { data: wf, error: wfError } = await supabase
      .from('business_workflows')
      .select('active_version_id')
      .eq('id', workflowId)
      .single();
      
    if (wfError || !wf?.active_version_id) return null;
    return this.getById(wf.active_version_id);
  }

  async setActiveVersion(workflowId: string, versionId: string): Promise<void> {
    const { error } = await supabase
      .from('business_workflows')
      .update({ active_version_id: versionId })
      .eq('id', workflowId);
      
    if (error) throw new Error(`Failed to set active version: ${error.message}`);
  }

  async updateStatus(versionId: string, status: 'deprecated' | 'yanked'): Promise<void> {
    const { error: dbError } = await supabase
      .from('workflow_versions')
      .update({ status })
      .eq('id', versionId);
      
    if (dbError) throw new Error(`Failed to update status in DB: ${dbError.message}`);
    
    // Also need to update the immutable manifest JSON block in the DB for completeness
    // (Though technically, the ABI status is in the manifest itself, we patch it in the DB JSON)
    const { data } = await supabase.from('workflow_versions').select('manifest').eq('id', versionId).single();
    if (data && data.manifest) {
       const manifest = data.manifest as WorkflowManifest;
       manifest.status = status;
       await supabase.from('workflow_versions').update({ manifest }).eq('id', versionId);
    }
  }
}
