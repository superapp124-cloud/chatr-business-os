/**
 * CHATR Intent Observer — Types
 * Genesis v1.0 — Prompt Library Edition
 */

export type IntentType =
  | 'MEETING'
  | 'REMINDER'
  | 'CONTACT'
  | 'TASK'
  | 'NOTE'
  | 'CHECKLIST'
  | 'CALL'
  | 'EMAIL'
  | 'CALENDAR_EVENT'
  | 'DOCUMENT'
  | 'CANDIDATE_INTERVIEW'
  | 'EXPENSE'
  | 'FLIGHT_BOOKING'
  | 'HOTEL_BOOKING'
  | 'FOLLOW_UP';

export interface UnderstandingProvenance {
  source: 'regex' | 'knowledge' | 'time' | 'llm' | 'user';
  verified: boolean;
  resolver: string;
  timestamp: string;
}

export interface UnderstandingEntity {
  value: string;
  provenance: UnderstandingProvenance;
}

export interface Understanding {
  id: string;
  type: IntentType;
  confidence: {
    observation: number;
    meaning: number;
    execution: number;
  };
  entities: {
    people: UnderstandingEntity[];
    dates: UnderstandingEntity[];
    locations: UnderstandingEntity[];
    organizations: UnderstandingEntity[];
  };
  temporalState: 'now' | 'today' | 'tomorrow' | 'next_week' | 'unknown';
  source: 'regex' | 'knowledge' | 'semantic' | 'llm';
  enrichments: any[];
  readyForSuggestion: boolean;
}

export interface IntentChip {
  type: IntentType;
  label: string;
  emoji: string;
  confidence: number;
  enrichedText?: string;
  isEnriching?: boolean;
}

export const INTENT_CHIP_CONFIG: Record<IntentType, { label: string; emoji: string; color: string; bg: string }> = {
  MEETING:              { label: 'Schedule Meeting',    emoji: '📅', color: '#3B82F6', bg: '#EFF6FF' },
  REMINDER:             { label: 'Set Reminder',        emoji: '🔔', color: '#8B5CF6', bg: '#F5F3FF' },
  CONTACT:              { label: 'Save Contact',        emoji: '👤', color: '#10B981', bg: '#ECFDF5' },
  TASK:                 { label: 'Create Task',         emoji: '✅', color: '#F59E0B', bg: '#FFFBEB' },
  NOTE:                 { label: 'Save Note',           emoji: '📝', color: '#6366F1', bg: '#EEF2FF' },
  CHECKLIST:            { label: 'Create Checklist',    emoji: '☑️', color: '#06B6D4', bg: '#ECFEFF' },
  CALL:                 { label: 'Make a Call',         emoji: '📞', color: '#22C55E', bg: '#F0FDF4' },
  EMAIL:                { label: 'Send Email',          emoji: '✉️', color: '#F97316', bg: '#FFF7ED' },
  CALENDAR_EVENT:       { label: 'Add to Calendar',    emoji: '🗓️', color: '#EC4899', bg: '#FDF2F8' },
  DOCUMENT:             { label: 'Create Document',    emoji: '📄', color: '#64748B', bg: '#F8FAFC' },
  CANDIDATE_INTERVIEW:  { label: 'Schedule Interview', emoji: '🤝', color: '#A855F7', bg: '#FAF5FF' },
  EXPENSE:              { label: 'Log Expense',         emoji: '💰', color: '#EAB308', bg: '#FEFCE8' },
  FLIGHT_BOOKING:       { label: 'Book Flight',         emoji: '✈️', color: '#0EA5E9', bg: '#F0F9FF' },
  HOTEL_BOOKING:        { label: 'Book Hotel',          emoji: '🏨', color: '#84CC16', bg: '#F7FEE7' },
  FOLLOW_UP:            { label: 'Set Follow-up',       emoji: '🔁', color: '#F43F5E', bg: '#FFF1F2' },
};
