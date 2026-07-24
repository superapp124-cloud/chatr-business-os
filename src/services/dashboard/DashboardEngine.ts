import { LocalDB } from '../db/LocalDB';

export interface DailyStats {
  totalEmails: number;
  priority: number;
  repliesNeeded: number;
  threatsBlocked: number;
  meetings: number;
  billsDue: number;
  deliveries: number;
}

export class DashboardEngine {
  /**
   * Generates aggregate daily statistics based on the messages in LocalDB.
   */
  static async getDailyStats(): Promise<DailyStats> {
    const messages = await LocalDB.getAllMessages();
    
    // For MVP, we treat the local cache as "Today's" messages,
    // though in production we would filter by internalDate > startOfDay.
    
    const stats: DailyStats = {
      totalEmails: messages.length,
      priority: 0,
      repliesNeeded: 0,
      threatsBlocked: 0,
      meetings: 0,
      billsDue: 0,
      deliveries: 0
    };

    for (const msg of messages) {
      if (msg.threatLevel === 'scam' || msg.threatLevel === 'suspicious') {
        stats.threatsBlocked++;
      }
      if (msg.attentionLevel === 'high') {
        stats.priority++;
      }
      if (msg.category === 'Finance') {
        stats.billsDue++;
      }
      if (msg.category === 'Deliveries') {
        stats.deliveries++;
      }
      // Heuristic for meetings & replies
      if (msg.subject.toLowerCase().includes('invitation') || msg.snippet.toLowerCase().includes('scheduled')) {
        stats.meetings++;
      }
      if (msg.snippet.toLowerCase().includes('?') || msg.subject.toLowerCase().includes('action required')) {
        stats.repliesNeeded++;
      }
    }

    return stats;
  }

  /**
   * Programmatically generates a natural language summary of the day's events.
   * Simulates the output of a local LLM.
   */
  static generateBriefingText(stats: DailyStats): string {
    if (stats.totalEmails === 0) {
      return "Your inbox is empty and fully secure. No pending actions today.";
    }

    const sentences: string[] = [`You have ${stats.totalEmails} emails.`];
    
    const details = [];
    if (stats.meetings > 0) {
      details.push(`${stats.meetings} require${stats.meetings === 1 ? 's' : ''} a reply today`);
    }
    if (stats.billsDue > 0) {
      details.push(`${stats.billsDue} payment${stats.billsDue === 1 ? ' is' : 's are'} due this week`);
    }
    if (stats.threatsBlocked > 0) {
      details.push(`${stats.threatsBlocked} security threat${stats.threatsBlocked === 1 ? ' was' : 's were'} blocked`);
    } else {
      details.push(`no security threats were detected`);
    }

    if (details.length > 0) {
      if (details.length === 1) {
        sentences.push(details[0].charAt(0).toUpperCase() + details[0].slice(1) + ".");
      } else if (details.length === 2) {
        sentences.push(`${details[0].charAt(0).toUpperCase() + details[0].slice(1)} and ${details[1]}.`);
      } else {
        const last = details.pop();
        sentences.push(`${details[0].charAt(0).toUpperCase() + details[0].slice(1)}, ${details.slice(1).join(', ')}, and ${last}.`);
      }
    }

    const estMinutes = Math.max(1, Math.ceil(stats.totalEmails / 15));
    sentences.push(`Estimated review time: ${estMinutes} minute${estMinutes === 1 ? '' : 's'}.`);

    return sentences.join(' ');
  }
}
