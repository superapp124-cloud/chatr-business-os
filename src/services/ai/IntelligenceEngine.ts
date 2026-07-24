import { EmailMessage } from '../mail/types';
import { StoredMessage } from '../db/LocalDB';
import { PhishingDetector } from './PhishingDetector';
import { Categorizer } from './Categorizer';
import { Summarizer } from './Summarizer';
import { ActionEngine } from './ActionEngine';

export class IntelligenceEngine {
  /**
   * Processes an array of raw emails locally on the device.
   * Runs heuristics (or an ONNX model) to enrich them with AI intelligence
   * before they are stored in the local SQLite database.
   */
  static processBatch(accountId: string, messages: EmailMessage[]): StoredMessage[] {
    console.log(`[IntelligenceEngine] Processing ${messages.length} raw emails for account ${accountId}`);
    
    return messages.map(msg => {
      const phishingAnalysis = PhishingDetector.analyze(msg);
      const category = Categorizer.analyze(msg);
      const summary = Summarizer.analyze(msg);
      const actions = ActionEngine.generateActions(msg, phishingAnalysis.threatLevel, category);

      // In a real local pipeline, we would query the local SQLite DB to calculate 
      // Relationship Intelligence (e.g. "Have we emailed this person before?")
      const isFirstContact = Math.random() > 0.8;
      
      return {
        ...msg,
        accountId,
        isRead: false,
        threatLevel: phishingAnalysis.threatLevel,
        intelligenceSummary: phishingAnalysis.threatLevel === 'scam' ? phishingAnalysis.reasons : summary,
        attentionScore: phishingAnalysis.attentionScore,
        category: phishingAnalysis.threatLevel === 'scam' ? 'Threat' : category,
        relationshipStats: {
          isVerified: phishingAnalysis.threatLevel !== 'scam',
          previousEmailsCount: isFirstContact ? 0 : Math.floor(Math.random() * 50) + 1,
          isFirstContact
        },
        recommendation: actions.recommendation,
        smartReplies: actions.smartReplies
      };
    });
  }
}
