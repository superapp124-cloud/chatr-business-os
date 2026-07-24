import { EmailMessage } from '../mail/types';

export interface ActionPayload {
  recommendation: {
    text: string;
    actionLabel: string;
    actionStyle: 'danger' | 'normal';
  };
  smartReplies: string[];
}

export class ActionEngine {
  /**
   * Generates contextual recommendations and smart replies based on email category and threat level.
   */
  static generateActions(message: EmailMessage, threatLevel: string, category: string): ActionPayload {
    const lowerSubject = message.subject.toLowerCase();

    // 1. Threat / Scam overrides everything
    if (threatLevel === 'scam' || threatLevel === 'suspicious') {
      return {
        recommendation: {
          text: 'Safe to ignore and delete.',
          actionLabel: 'Delete Forever',
          actionStyle: 'danger'
        },
        smartReplies: [] // No replies for scams
      };
    }

    // 2. Finance / Receipts
    if (category === 'Finance') {
      return {
        recommendation: {
          text: 'No action needed.',
          actionLabel: 'View Receipt',
          actionStyle: 'normal'
        },
        smartReplies: [
          '"Thank you for the receipt."',
          '"Please resend the invoice."',
          '"I have an issue with this payment."'
        ]
      };
    }

    // 3. Deliveries
    if (category === 'Deliveries') {
      return {
        recommendation: {
          text: 'Track your package.',
          actionLabel: 'View Tracking',
          actionStyle: 'normal'
        },
        smartReplies: [
          '"Can I change the delivery address?"',
          '"Hold at location."'
        ]
      };
    }

    // 4. Updates / Developer
    if (category === 'Updates' || lowerSubject.includes('pr') || lowerSubject.includes('merged')) {
      return {
        recommendation: {
          text: 'Informational only.',
          actionLabel: 'View Update',
          actionStyle: 'normal'
        },
        smartReplies: [
          '"Great job!"',
          '"Looks good to me (LGTM)."',
          '"Thanks for the update."'
        ]
      };
    }

    // Default Fallback
    return {
      recommendation: {
        text: 'Standard response suggested.',
        actionLabel: 'Reply',
        actionStyle: 'normal'
      },
      smartReplies: [
        '"Sounds good."',
        '"Thanks!"',
        '"I will get back to you soon."'
      ]
    };
  }
}
