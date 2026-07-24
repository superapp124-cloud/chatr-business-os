export interface ResumeArtifact {
  id: string;
  candidateName: string;
  contact: string;
  skills: string[];
  experienceYears: number;
  education: string;
  certifications: string[];
  rawText?: string;
}

export interface CandidateMatchArtifact {
  overallMatch: number; // 0 to 100
  requiredSkillsMatched: string[];
  missingSkills: string[];
  riskAreas: string[];
  salaryEstimate: string;
  recommendation: 'PROCEED_TO_INTERVIEW' | 'REJECT' | 'HOLD';
}

export interface InterviewPlanArtifact {
  interviewPlan: Array<{
    type: string;
    focus: string;
    questions: string[];
  }>;
}

export interface OfferArtifact {
  candidateName: string;
  role: string;
  salaryOffered: string;
  joiningDate: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';
}

export type HiringPipelineStage = 'INTAKE' | 'PARSE' | 'MATCH' | 'INTERVIEW' | 'OFFER' | 'ONBOARDING';
export type HiringStageStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface HiringPipelineState {
  stages: Record<HiringPipelineStage, HiringStageStatus>;
  currentStage: HiringPipelineStage;
  resumeFileUrl?: string;
  resumeArtifact?: ResumeArtifact;
  matchArtifact?: CandidateMatchArtifact;
  interviewPlan?: InterviewPlanArtifact;
  offerArtifact?: OfferArtifact;
}
