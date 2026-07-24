import { Commitment } from '../capabilities/types';

/**
 * Enterprise Security Engine (Identity & Permission)
 * 
 * Manages user identity, standard enterprise roles, and RBAC authorization.
 */

export interface EnterpriseUser {
  id: string;
  name: string;
  role: 'employee' | 'manager' | 'admin' | 'finance_approver';
  department: string;
}

export class SecurityEngineImpl {
  private static instance: SecurityEngineImpl;

  // Mock Directory for local testing without a real IdP
  private mockDirectory: Record<string, EnterpriseUser> = {
    'user-123': { id: 'user-123', name: 'Current User', role: 'employee', department: 'Engineering' },
    'mgr-456': { id: 'mgr-456', name: 'Jane Manager', role: 'manager', department: 'Engineering' },
    'fin-789': { id: 'fin-789', name: 'Finance Dept', role: 'finance_approver', department: 'Finance' },
  };

  private constructor() {}

  public static getInstance(): SecurityEngineImpl {
    if (!SecurityEngineImpl.instance) {
      SecurityEngineImpl.instance = new SecurityEngineImpl();
    }
    return SecurityEngineImpl.instance;
  }

  public async authenticate(userId: string): Promise<EnterpriseUser | null> {
    // In production, this would validate a JWT token
    const user = this.mockDirectory[userId];
    if (user) {
      console.log(`[SecurityEngine] Authenticated: ${user.name} (${user.role})`);
    } else {
      console.warn(`[SecurityEngine] Authentication failed for ${userId}`);
    }
    return user || null;
  }

  public async authorize(user: EnterpriseUser, capabilityId: string): Promise<{ authorized: boolean; reason?: string }> {
    console.log(`[SecurityEngine] Authorizing ${user.name} for ${capabilityId}`);
    
    // Simplistic RBAC
    if (capabilityId === 'core.expense_approval' && user.role !== 'manager' && user.role !== 'admin') {
      return { authorized: false, reason: 'Only managers can approve expenses.' };
    }

    if (capabilityId === 'core.user_management' && user.role !== 'admin') {
      return { authorized: false, reason: 'Requires Admin privileges.' };
    }

    return { authorized: true };
  }
}

export const securityEngine = SecurityEngineImpl.getInstance();
