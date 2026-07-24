import { EmailMessage } from '../mail/types';

export class Categorizer {
  static analyze(message: EmailMessage): string {
    const lowerSubject = message.subject.toLowerCase();
    const lowerSender = message.sender.toLowerCase();

    if (lowerSender.includes('apple') || lowerSubject.includes('receipt') || lowerSubject.includes('invoice') || lowerSubject.includes('charged')) {
      return 'Finance';
    }

    if (lowerSubject.includes('shipped') || lowerSubject.includes('delivery')) {
      return 'Deliveries';
    }

    if (lowerSender.includes('github') || lowerSubject.includes('merged') || lowerSubject.includes('update')) {
      return 'Updates';
    }

    return 'Personal';
  }
}
