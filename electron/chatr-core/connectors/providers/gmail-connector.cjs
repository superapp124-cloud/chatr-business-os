'use strict';

/**
 * CHATR OS - Gmail Connector (Simulated)
 * Simulates connecting to Google Workspace to pull emails.
 */

class GmailConnector {
  constructor() {
    this.name = 'Gmail';
    this.id = 'provider.google.gmail';
  }

  async sync() {
    // Simulate network latency
    await new Promise(r => setTimeout(r, 600));

    // Return realistic simulated emails
    return [
      {
        id: 'msg_001',
        sender: 'Rajesh Sharma <rajesh@partner-corp.com>',
        subject: 'Re: Q3 Contract Review',
        snippet: 'Hi Arshid, I need your final approval on the Q3 contract before Friday. Can we jump on a quick call?',
        priority: 'high',
        requires_reply: true,
        received_at: Date.now() - 3600000 // 1 hour ago
      },
      {
        id: 'msg_002',
        sender: 'GoAir <alerts@goair.in>',
        subject: 'Flight Price Drop: BOM to GOI',
        snippet: 'Great news! Your tracked flight to Goa has dropped by ₹12,400. Book now to secure this rate.',
        priority: 'medium',
        requires_reply: false,
        received_at: Date.now() - 7200000 // 2 hours ago
      },
      {
        id: 'msg_003',
        sender: 'Marketing Team <marketing@chatr.app>',
        subject: 'Weekly Newsletter Draft',
        snippet: 'Here is the draft for this week. No action needed unless you have edits.',
        priority: 'low',
        requires_reply: false,
        received_at: Date.now() - 14400000 // 4 hours ago
      },
      // Simulate a batch of low-priority / spam emails that get auto-filtered
      ...Array.from({ length: 124 }, (_, i) => ({
        id: `spam_${i}`,
        sender: 'Promotions <promo@random.com>',
        subject: 'Save 20% today!',
        snippet: 'Don\'t miss out on this deal.',
        priority: 'low',
        requires_reply: false,
        auto_archived: true, // Marker for our aggregator
        received_at: Date.now() - 86400000
      }))
    ];
  }
}

module.exports = { GmailConnector, gmailConnector: new GmailConnector() };
