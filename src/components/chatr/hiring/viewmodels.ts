import { ResumeArtifact, CandidateMatchArtifact, InterviewPlanArtifact, OfferArtifact } from '@/core/capabilities/hiring/artifacts';

export interface HiringAnalysisViewModel {
  candidateName: string;
  contact: string;
  matchPercentage: number;
  skills: string[];
  missingSkills: string[];
  recommendation: string;
  reasoning: string;
  experienceYears: number;
  education: string;
  confidence: number;
}

export function mapToAnalysisViewModel(resume: ResumeArtifact, match: CandidateMatchArtifact): HiringAnalysisViewModel {
  return {
    candidateName: resume.candidateName,
    contact: resume.contact,
    matchPercentage: match.overallMatch,
    skills: resume.skills,
    missingSkills: match.missingSkills,
    recommendation: match.recommendation.replace(/_/g, ' '),
    reasoning: match.reasoning_summary || resume.reasoning_summary || 'Analysis complete.',
    experienceYears: resume.experienceYears,
    education: resume.education,
    confidence: match.confidence,
  };
}

export interface InterviewPrepViewModel {
  candidateName: string;
  sections: Array<{ type: string; focus: string; questions: string[] }>;
  reasoning: string;
}

export function mapToInterviewPrepViewModel(resume: ResumeArtifact, plan: InterviewPlanArtifact): InterviewPrepViewModel {
  return {
    candidateName: resume.candidateName,
    sections: plan.interviewPlan,
    reasoning: plan.reasoning_summary || 'Questions tailored to candidate gaps.'
  };
}

export interface OfferViewModel {
  candidateName: string;
  role: string;
  salary: string;
  status: string;
}

export function mapToOfferViewModel(offer: OfferArtifact): OfferViewModel {
  return {
    candidateName: offer.candidateName,
    role: offer.role,
    salary: offer.salaryOffered,
    status: offer.status
  };
}
