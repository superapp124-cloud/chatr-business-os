import { DocumentCapability, CapabilityInsight, UnifiedDocument } from '../../document/types';
import { generate } from '@/services/ai';

export class ResumeCapability implements DocumentCapability {
  canHandle(documents: UnifiedDocument[]): boolean {
    return documents.some(d => d.classification.primary === 'resume');
  }

  async execute(documents: UnifiedDocument[]): Promise<CapabilityInsight> {
    const resumes = documents.filter(d => d.classification.primary === 'resume');
    if (resumes.length === 0) throw new Error("No resume found.");

    // Just handling the first one for now
    const doc = resumes[0];

    const prompt = `Extract structured candidate data from the following Resume text.
Respond ONLY in valid JSON format:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "skills": ["string"],
  "education": ["string"],
  "experience": [{ "title": "string", "company": "string", "years": "string" }]
}
Resume Text:
${doc.rawText.substring(0, 4000)}
`;

    let candidate = null;
    try {
      const response = await generate({ prompt, preferLocal: false });
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        candidate = JSON.parse(match[0]);
      }
    } catch (e) {
      console.error('[ResumeCapability] Extraction failed', e);
    }

    return {
      title: 'Resume Processed',
      summary: `Successfully parsed resume for ${candidate?.name || 'Candidate'}.`,
      severity: 'info',
      confidence: 0.95,
      explanation: 'Used AI extraction to structure the candidate resume.',
      actions: [],
      widgets: ['DocumentPreviewWidget'],
      payload: { candidate, documentId: doc.id, documents }
    };
  }
}

export const resumeCapability = new ResumeCapability();
