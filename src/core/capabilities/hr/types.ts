export interface BaseArtifact {
  id: string;
  version: number;
  createdAt: number;
  createdBy: string;
  relatedArtifacts: string[];
}

export interface LeaveRequestArtifact extends BaseArtifact {
  type: 'LeaveRequestArtifact';
  employeeId: string;
  employeeName: string;
  leaveType: 'SICK' | 'CASUAL' | 'EARNED' | 'UNPAID';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  managerId: string;
}

export interface SalarySlipArtifact extends BaseArtifact {
  type: 'SalarySlipArtifact';
  employeeId: string;
  month: string;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
}

export interface OrgChartArtifact extends BaseArtifact {
  type: 'OrgChartArtifact';
  department: string;
  manager: string;
  directReports: string[];
}
