import { supabase } from '@/integrations/supabase/client';

export type OrchestrationEventType =
  | 'message.received'
  | 'call.ended'
  | 'mobile_action.completed';

export interface RecruitmentCandidateForAutomation {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  applied_for?: string | null;
}

export async function emitOrchestrationEvent(
  eventType: OrchestrationEventType,
  payload: Record<string, unknown>,
  source = 'desktop',
) {
  const { data, error } = await supabase.functions.invoke('orchestration-event-router', {
    body: { eventType, source, payload },
  });

  if (error) throw error;
  return data;
}

export function getCandidateDisplayName(candidate: RecruitmentCandidateForAutomation) {
  return `${candidate.first_name} ${candidate.last_name}`.trim();
}

export async function simulatePositiveRecruitmentResponse(candidate: RecruitmentCandidateForAutomation) {
  return emitOrchestrationEvent('message.received', {
    candidateId: candidate.id,
    candidateName: getCandidateDisplayName(candidate),
    phone: candidate.phone,
    email: candidate.email,
    requisitionId: candidate.applied_for,
    content: 'Interested in the role. Happy to speak with the recruiter.',
  }, 'desktop.recruiter_demo');
}

export async function markRecruitmentCallInterviewScheduled(candidate: RecruitmentCandidateForAutomation) {
  return emitOrchestrationEvent('call.ended', {
    candidateId: candidate.id,
    candidateName: getCandidateDisplayName(candidate),
    phone: candidate.phone,
    email: candidate.email,
    requisitionId: candidate.applied_for,
    outcome: 'interview_scheduled',
  }, 'desktop.recruiter_demo');
}
