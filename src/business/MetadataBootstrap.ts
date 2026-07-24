import { supabase } from '@/integrations/supabase/client';

export const bootstrapMetadata = async (organizationId: string) => {
  // Example mapping of the existing CRM module to the Metadata Graph
  
  // 1. Create CRM Module
  const { data: crmModule } = await supabase.from('sys_modules').insert({
    organization_id: organizationId,
    name: 'CRM',
    description: 'Customer Relationship Management',
    config_json: { icon: 'Users', color: 'blue' }
  }).select().single();

  // 2. Create Customer Entity
  const { data: customerEntity } = await supabase.from('sys_entities').insert({
    module_id: crmModule.id,
    name: 'Customer',
    table_name: 'crm_customers', // Maps to the original table
    state_machine_json: {
      states: ['Lead', 'Active', 'Churned'],
      transitions: [
        { fromState: 'Lead', toState: 'Active', allowedRoles: ['admin', 'sales'] },
        { fromState: 'Active', toState: 'Churned', allowedRoles: ['admin'] }
      ]
    }
  }).select().single();

  // 3. Create Views mapping exactly to the existing UI
  await supabase.from('sys_views').insert([
    {
      entity_id: customerEntity.id,
      type: 'table',
      name: 'CustomerList',
      layout_json: {
        columns: [
          { name: 'name', label: 'Company Name', width: '200px' },
          { name: 'email', label: 'Email', width: '200px' },
          { name: 'status', label: 'Status', width: '100px' }
        ]
      }
    },
    {
      entity_id: customerEntity.id,
      type: 'form',
      name: 'CustomerForm',
      layout_json: {
        fields: [
          { name: 'name', label: 'Company Name', type: 'string', required: true },
          { name: 'email', label: 'Email', type: 'string', required: true }
        ]
      }
    }
  ]);

  console.log('Metadata Graph Bootstrapped successfully for Org', organizationId);
};
