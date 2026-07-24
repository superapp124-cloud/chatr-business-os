import { supabase } from '@/integrations/supabase/client';

export interface SemanticObject {
  id: string;
  package_id: string;
  object_name: string;
  plural_name: string;
  icon: string | null;
}

export interface SemanticRecord {
  id: string;
  object_id: string;
  data: Record<string, any>;
  status: string;
  created_at: string;
}

export const SemanticEngineService = {
  /**
   * Fetch all installed capability packages for the tenant
   */
  async getInstalledPackages() {
    const { data, error } = await supabase
      .from('pkg_manifests')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching packages:', error);
      // Fallback for UI if DB isn't seeded yet
      return [
        { package_id: 'recruitment', name: 'Recruitment & HR', maturity_level: 'L4' }
      ];
    }
    return data;
  },

  /**
   * Fetch the schema definition for a specific semantic object
   */
  async getObjectSchema(objectName: string): Promise<SemanticObject | null> {
    const { data, error } = await supabase
      .from('sem_objects')
      .select('*')
      .eq('object_name', objectName)
      .single();
    
    if (error) {
      console.error('Error fetching object schema:', error);
      // Fallback
      return {
        id: '11111111-1111-1111-1111-111111111111',
        package_id: 'recruitment',
        object_name: 'Candidate',
        plural_name: 'Candidates',
        icon: 'Users'
      };
    }
    return data;
  },

  /**
   * Fetch records dynamically for a given semantic object
   */
  async getRecords(objectId: string): Promise<SemanticRecord[]> {
    const { data, error } = await supabase
      .from('sem_records')
      .select('*')
      .eq('object_id', objectId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching semantic records:', error);
      // Fallback dummy data if migration hasn't applied
      return [
        { id: '1', object_id: objectId, status: 'interview', created_at: new Date().toISOString(), data: { first_name: 'Sarah', last_name: 'Jenkins', role: 'Senior Frontend Engineer', email: 'sarah.j@example.com', score: 94 } },
        { id: '2', object_id: objectId, status: 'shortlisted', created_at: new Date().toISOString(), data: { first_name: 'Michael', last_name: 'Chen', role: 'Product Designer', email: 'mchen@example.com', score: 88 } },
        { id: '3', object_id: objectId, status: 'new', created_at: new Date().toISOString(), data: { first_name: 'Elena', last_name: 'Rodriguez', role: 'Backend Engineer', email: 'elena.r@example.com', score: 91 } },
      ];
    }
    return data || [];
  },

  /**
   * Create a new semantic record
   */
  async createRecord(objectId: string, payload: Record<string, any>, status: string = 'new') {
    const { data, error } = await supabase
      .from('sem_records')
      .insert([
        { object_id: objectId, data: payload, status }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating record:', error);
      // Mock response for fallback
      return { id: Math.random().toString(), object_id: objectId, data: payload, status, created_at: new Date().toISOString() };
    }
    return data;
  },

  /**
   * Update a semantic record (e.g., drag and drop on Kanban)
   */
  async updateRecordStatus(recordId: string, newStatus: string) {
    const { error } = await supabase
      .from('sem_records')
      .update({ status: newStatus })
      .eq('id', recordId);
    
    if (error) {
      console.error('Error updating record:', error);
      return false;
    }
    return true;
  }
};
