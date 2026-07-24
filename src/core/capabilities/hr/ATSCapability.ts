import { DocumentCapability, CapabilityInsight, UnifiedDocument } from '../../document/types';
import { generate } from '@/services/ai';
import { resumeCapability } from './ResumeCapability';

export class ATSCapability implements DocumentCapability {
  canHandle(documents: UnifiedDocument[]): boolean {
    // ATS needs both a resume and a JD. But we might just have a resume and pass a JD text via intent.
    // For now, if we have a resume, we can try ATS Scoring if the intent asks for it.
    return documents.some(d => d.classification.primary === 'resume');
  }

  async execute(documents: UnifiedDocument[], jdText?: string): Promise<CapabilityInsight> {
    // First run ResumeCapability to extract structured candidate data
    const resumeResult = await resumeCapability.execute(documents);
    const candidate = resumeResult.payload.candidate;

    if (!jdText) {
      jdText = "Generic Software Engineer role expecting frontend and backend skills.";
    }

    const prompt = `You are an expert ATS (Applicant Tracking System). Compare this Candidate to the Job Description.
Job Description:
${jdText}

Candidate Profile:
${JSON.stringify(candidate, null, 2)}

Calculate a match score (0-100) and respond ONLY in valid JSON format:
{
  "score": number,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "missingSkills": ["string"],
  "interviewQuestions": ["string"],
  "recommendation": "Strong Hire|Hire|No Hire"
}
`;

    let atsResult = null;
    try {
      const response = await generate({ prompt, preferLocal: false });
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        atsResult = JSON.parse(match[0]);
      }
    } catch (e) {
      console.error('[ATSCapability] Scoring failed', e);
    }

    if (!atsResult) {
      throw new Error("Failed to generate ATS Score.");
    }

    return {
      title: `ATS Score: ${atsResult.score}%`,
      summary: `Candidate ${candidate?.name || 'Unknown'} is a ${atsResult.recommendation}.`,
      severity: atsResult.score > 75 ? 'info' : 'warning',
      confidence: 0.9,
      explanation: `Matched based on candidate skills vs JD requirements. Missing skills: ${atsResult.missingSkills.join(', ')}`,
      actions: [],
      widgets: ['ATSResultWidget'],
      payload: { atsResult, candidate, documentId: resumeResult.payload.documentId }
    };
  }
}

export const atsCapability = new ATSCapability();
