import { EmailMessage } from '../mail/types';

export interface PhishingResult {
  threatLevel: 'safe' | 'suspicious' | 'scam';
  attentionScore: 'high' | 'medium' | 'low' | 'ignore';
  reasons: string[];
}

export class PhishingDetector {
  /**
   * Evaluates an email for phishing patterns locally using heuristics.
   * In the future, this can be replaced by a local ONNX ML model.
   */
  static analyze(message: EmailMessage): PhishingResult {
    const reasons: string[] = [];
    let score = 0;

    const senderDomainMatch = message.sender.match(/@([\w.-]+)/);
    const senderDomain = senderDomainMatch ? senderDomainMatch[1].toLowerCase() : '';

    // Check for domain mismatches (common in phishing)
    if (message.sender.includes('paypal') && !senderDomain.includes('paypal.com')) {
      reasons.push('Sender domain differs from official PayPal');
      score += 50;
    }

    // Check for urgent language
    const urgentKeywords = ['urgent', 'action required', 'suspended', 'restricted', 'verify your identity'];
    const lowerSubject = message.subject.toLowerCase();
    const lowerSnippet = message.snippet.toLowerCase();

    for (const kw of urgentKeywords) {
      if (lowerSubject.includes(kw) || lowerSnippet.includes(kw)) {
        reasons.push(`Urgent language detected: "${kw}"`);
        score += 30;
      }
    }

    if (score >= 80) {
      return { threatLevel: 'scam', attentionScore: 'high', reasons };
    } else if (score >= 30) {
      return { threatLevel: 'suspicious', attentionScore: 'medium', reasons };
    }

    return { threatLevel: 'safe', attentionScore: 'low', reasons: [] };
  }
}
