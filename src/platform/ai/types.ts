export type ChatrAIToolCategory =
  | 'conversation'
  | 'messaging'
  | 'calling'
  | 'calendar'
  | 'browser'
  | 'search'
  | 'workflow'
  | 'crm'
  | 'files'
  | 'email'
  | 'payments'
  | 'notifications';

export type ChatrAIToolRiskLevel = 'low' | 'medium' | 'high';

export type ChatrAIToolStatus = 'available' | 'metadata_only' | 'disabled';

export type ChatrAIToolSurface = 'mobile' | 'desktop' | 'business' | 'enterprise' | 'system';

export interface ChatrAIToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ChatrAIToolCategory;
  requiredPermissions: string[];
  riskLevel: ChatrAIToolRiskLevel;
  requiresApproval: boolean;
  status: ChatrAIToolStatus;
  surfaces: ChatrAIToolSurface[];
  eventTypes: string[];
  guardrails: string[];
}
