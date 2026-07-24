import { IMemoryProvider, EnterprisePerson, EnterprisePolicy, EnterpriseProject } from '../capabilities/types';

export class MockEnterpriseProvider implements IMemoryProvider {
  id = 'mock-enterprise-1';
  name = 'Mock Enterprise Data';

  private people: EnterprisePerson[] = [
    {
      id: 'p-1',
      name: 'Rahul Sharma',
      email: 'rahul@company.com',
      role: 'Manager',
      department: 'Sales'
    },
    {
      id: 'p-2',
      name: 'John Smith',
      email: 'john@company.com',
      role: 'HR Business Partner',
      department: 'HR'
    }
  ];

  private policies: EnterprisePolicy[] = [
    {
      id: 'pol-1',
      topic: 'expense travel',
      content: 'Expenses over $1000 require Manager approval.',
      requiresApproval: true,
      approverRole: 'manager',
      maxAmount: 1000
    },
    {
      id: 'pol-2',
      topic: 'leave pto',
      content: 'Unpaid leave requires Manager approval.',
      requiresApproval: true,
      approverRole: 'manager'
    }
  ];

  private projects: EnterpriseProject[] = [
    {
      id: 'proj-1',
      name: 'Project Atlas',
      leadId: 'p-1',
      members: ['p-1', 'p-2']
    }
  ];

  async resolvePerson(query: string): Promise<EnterprisePerson[]> {
    const lower = query.toLowerCase();
    
    // Semantic mock matching
    if (lower.includes('manager') || lower.includes('rahul')) {
      return [this.people[0]];
    }
    if (lower.includes('hr') || lower.includes('john')) {
      return [this.people[1]];
    }

    return [];
  }

  async resolvePolicy(topic: string): Promise<EnterprisePolicy[]> {
    const lower = topic.toLowerCase();
    
    if (lower.includes('expense') || lower.includes('travel')) {
      return [this.policies[0]];
    }
    if (lower.includes('leave') || lower.includes('pto')) {
      return [this.policies[1]];
    }

    return [];
  }

  async resolveProject(query: string): Promise<EnterpriseProject[]> {
    const lower = query.toLowerCase();
    if (lower.includes('atlas')) {
      return [this.projects[0]];
    }
    return [];
  }

  async search(query: string): Promise<any[]> {
    return []; // Fallback generic search
  }
}
