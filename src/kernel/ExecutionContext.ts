export interface ExecutionContext {
  correlationId: string;
  timestamp: string;
  
  // Identity
  user: {
    id: string;
    role: string;
    locale?: string;
    timezone?: string;
  };

  // Tenancy
  tenant: {
    organizationId: string;
    businessUnitId?: string;
    departmentId?: string;
    teamId?: string;
    workspaceId?: string;
  };

  // Device & Network
  device?: {
    ip: string;
    userAgent: string;
    platform: string;
  };

  // Security & State
  permissions?: Record<string, any>;
  policies?: Record<string, any>;
  memory?: Record<string, any>;
}

export const createExecutionContext = (
  userId: string, 
  role: string, 
  organizationId: string, 
  overrides?: Partial<ExecutionContext>
): ExecutionContext => {
  return {
    correlationId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    user: {
      id: userId,
      role: role,
      ...overrides?.user
    },
    tenant: {
      organizationId,
      ...overrides?.tenant
    },
    ...overrides
  };
};
