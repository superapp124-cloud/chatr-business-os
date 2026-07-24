/**
 * CHATR OS — Context Runtime
 * 
 * Enriches a parsed user intent with the full organizational context before planning begins.
 * Implements strict capability resolution and permission context generation.
 */
import { BusinessObjectStore } from './BusinessObjectStore';
import { PolicyEngine } from './PolicyEngine';
import { IIntent } from './IntentEngine';

export class ResolutionError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'ResolutionError';
  }
}

export interface IBusinessContext {
  intent: IIntent;
  capabilityId: string;
  businessObject: string;
  user: {
    id: string;
    roles: string[];
  };
  currentRecord: any | null;
  policies: any[];
  memory: any[];
}

export class ContextRuntime {
  /**
   * Entity to Capability Resolution Registry
   */
  private static entityMap: Record<string, { capability: string, object: string }> = {
    'job': { capability: 'HR.ATS', object: 'JobRequisition' },
    'candidate': { capability: 'HR.ATS', object: 'Candidate' },
    'invoice': { capability: 'Finance.Invoicing', object: 'Invoice' },
    'lead': { capability: 'CRM.OpportunityManagement', object: 'Lead' },
    'ticket': { capability: 'Support.Helpdesk', object: 'Ticket' },
    'leave': { capability: 'HR.LeaveManagement', object: 'LeaveRequest' },
    'resource': { capability: 'Operations.ProjectManagement', object: 'Resource' },
    'sprint': { capability: 'Operations.ProjectManagement', object: 'Sprint' },
    'quotation': { capability: 'CRM.Quotations', object: 'Quotation' },
    'interview': { capability: 'HR.ATS', object: 'Interview' }
  };

  /**
   * Enrich the intent with business context.
   */
  static buildContext(intent: IIntent): IBusinessContext {
    // 1. Resolve Entity to Capability
    let capabilityId = 'System.Conversation';
    let businessObject = 'Unknown';

    if (intent.entity && intent.entity !== 'unknown') {
      const resolution = this.entityMap[intent.entity.toLowerCase()];
      if (!resolution) {
        throw new ResolutionError(`No capability found for action '${intent.action}' on entity '${intent.entity}'.`);
      }
      capabilityId = resolution.capability;
      businessObject = resolution.object;
    }

    // 2. Identify User Context (Mocking offline LocalSessionManager)
    const user = {
      id: 'local-dev',
      roles: ['admin', 'recruiter', 'manager']
    };

    // 3. Identify Current Record if applicable
    let currentRecord = null;
    if (intent.target || intent.subject) {
      const searchTerm = intent.target || intent.subject;
      const records = BusinessObjectStore.list(capabilityId, businessObject);
      currentRecord = records.find(r => 
        (r.name && r.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.title && r.title.toLowerCase().includes(searchTerm.toLowerCase()))
      ) || null;
    }

    // 4. Find Applicable Policies
    const policies = PolicyEngine.getPolicies(capabilityId).filter(p => p.object === businessObject);

    // 5. Memory / Knowledge (stubbed)
    const memory = [
      { type: 'BusinessMemory', note: 'Ensure compliance with standard operating procedures.' }
    ];

    return {
      intent,
      capabilityId,
      businessObject,
      user,
      currentRecord,
      policies,
      memory
    };
  }
}
