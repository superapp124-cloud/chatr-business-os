import { DocumentCapability, CapabilityInsight, UnifiedDocument } from './types';
import { resumeCapability } from '../capabilities/hr/ResumeCapability';
import { atsCapability } from '../capabilities/hr/ATSCapability';

export class DocumentCapabilityRouter {
  private capabilities: DocumentCapability[] = [];

  constructor() {
    this.capabilities.push(resumeCapability);
    this.capabilities.push(atsCapability);
  }

  async route(documents: UnifiedDocument[], intent?: string): Promise<CapabilityInsight> {
    // Determine which capability to run.
    // In a real OS, we could use the AI Intent Router to map intent -> capability.
    
    let targetCapability: DocumentCapability | null = null;

    if (intent?.toLowerCase().includes('score') || intent?.toLowerCase().includes('ats') || intent?.toLowerCase().includes('match')) {
      if (atsCapability.canHandle(documents)) {
        targetCapability = atsCapability;
      }
    } else {
      // Default to standard Resume parsing if it's a resume and no explicit ATS intent
      if (resumeCapability.canHandle(documents)) {
        targetCapability = resumeCapability;
      }
    }

    if (targetCapability) {
      return await targetCapability.execute(documents);
    }

    return {
      title: 'Document Understood',
      summary: `Processed ${documents.length} document(s).`,
      severity: 'info',
      confidence: 1.0,
      explanation: 'No specific capability was requested, so the documents were simply extracted and stored in the OS Document Registry.',
      actions: [],
      widgets: ['DocumentPreviewWidget'],
      payload: { documents }
    };
  }
}

export const documentCapabilityRouter = new DocumentCapabilityRouter();
