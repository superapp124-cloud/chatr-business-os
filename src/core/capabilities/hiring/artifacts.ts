export interface BaseArtifact {
  id: string;
  version: number;
  createdAt: number;
  createdBy: string; // e.g., "MockAIProvider"
  previousVersionId?: string;
  relatedArtifacts: string[]; // IDs of artifacts this was produced from
}

export interface SkillGraph {
  nodes: string[]; // e.g. ["React", "TypeScript", "System Design"]
  edges: Array<{ source: string; target: string; relationship: string }>;
}

export interface ResumeArtifact extends BaseArtifact {
  type: 'ResumeArtifact';
  candidateName: string;
  contact: string;
  skills: string[];
  skillGraph?: SkillGraph;
  experienceYears: number;
  education: string;
  certifications: string[];
  rawText?: string;
  confidence: number;
  reasoning_summary?: string;
}

export interface CandidateMatchArtifact extends BaseArtifact {
  type: 'CandidateMatchArtifact';
  overallMatch: number; // 0 to 100
  requiredSkillsMatched: string[];
  missingSkills: string[];
  riskAreas: string[];
  salaryEstimate: string;
  recommendation: 'PROCEED_TO_INTERVIEW' | 'REJECT' | 'HOLD';
  confidence: number;
  reasoning_summary?: string;
  missing_information?: string[];
}

export interface InterviewPlanArtifact extends BaseArtifact {
  type: 'InterviewPlanArtifact';
  interviewPlan: Array<{
    type: string; // e.g. Technical, Cultural
    focus: string;
    questions: string[];
  }>;
  confidence: number;
  reasoning_summary?: string;
}

export interface OfferArtifact extends BaseArtifact {
  type: 'OfferArtifact';
  candidateName: string;
  role: string;
  salaryOffered: string;
  joiningDate: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';
}
