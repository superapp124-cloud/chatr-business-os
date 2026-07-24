import type { Message, Room } from '@/platform/Domain/Communication/MessagingService';

export type { Message, Room };

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  workflowId?: string; // added to match useCopilot.ts
  isResolving?: boolean;
  executionProgress?: { status: string; timestamp: number }[];
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceReason?: string;
  explainability?: {
    fastest?: boolean;
    reliable?: boolean;
    live?: boolean;
    lowestCost?: boolean;
    verified?: boolean;
  };
}

export type RightPaneTab = 'copilot' | 'outcomes' | 'timeline' | 'decisions' | 'notes';
