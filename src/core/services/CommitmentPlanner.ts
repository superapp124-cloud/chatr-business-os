import { Intent, Commitment } from '../capabilities/types';
import { capabilityRegistry } from '../capabilities/CapabilityRegistry';
import { eventBus } from '@/core/runtime/EventBus';
import { contextResolutionPipeline } from './ContextResolutionPipeline';

/**
 * CHATR Commitment Planner
 * 
 * Routes an Intent to the best-matching Capability using a scored routing table.
 * 
 * Priority ordering prevents the generic Task fallback from swallowing
 * specific intents like "I need to fly to New York" → TASK.
 * 
 * Each entry maps a set of keywords → a capability ID with a priority weight.
 * The capability with the highest total score wins.
 */

interface RoutingRule {
  capabilityId: string;
  priority: number; // Higher = evaluated earlier; wins ties
  keywords: string[];
  patterns: RegExp[];
}

const ROUTING_TABLE: RoutingRule[] = [
  {
    capabilityId: 'core.flight_booking',
    priority: 100,
    keywords: [
      'fly', 'flight', 'flights', 'plane', 'airplane', 'flying',
      'air ticket', 'airfare', 'book a flight', 'book flight',
      'ticket to', 'ticket from', 'round trip', 'one way',
      'economy class', 'business class', 'first class',
      'emirates', 'indigo', 'air india', 'etihad', 'qatar airways',
      'british airways', 'lufthansa', 'united airlines', 'delta',
      'departing', 'arriving', 'landing in', 'taking off',
    ],
    patterns: [
      /\bfly (to|from|me|us)\b/i,
      /\bflight (to|from|back|returning)\b/i,
      /\b(book|get|find) (a |)(flight|ticket|air ticket)\b/i,
      /\b(return|round[- ]?trip|one[- ]?way) (flight|ticket)\b/i,
    ]
  },

  {
    capabilityId: 'core.hotel_booking',
    priority: 95,
    keywords: [
      'hotel', 'hotels', 'room', 'accommodation', 'stay', 'hostel',
      'airbnb', 'resort', 'inn', 'lodge', 'motel', 'suite',
      'check-in', 'check-out', 'check in', 'check out',
      'book a hotel', 'book hotel', 'book a room',
      'place to stay', 'somewhere to sleep',
      'marriott', 'hilton', 'hyatt', 'sheraton', 'westin',
      'holiday inn', 'ibis', 'taj hotel', 'oberoi', 'itc hotel',
    ],
    patterns: [
      /\b(book|find|get|reserve) (a |the |me a )?(hotel|room|accommodation)\b/i,
      /\b(stay|staying|check[- ]?in|check[- ]?out) (at|in|near)\b/i,
      /\b(one night|.+ nights?) (at|in|near)\b/i,
    ]
  },

  {
    capabilityId: 'core.expense',
    priority: 90,
    keywords: [
      'expense', 'expenses', 'receipt', 'reimbursement', 'reimburse',
      'spent', 'i spent', 'i paid', 'i purchased', 'i bought',
      'claim', 'petty cash', 'out of pocket', 'log expense',
      'submit expense', 'expense report', 'business expense',
      'corporate card', 'company card',
    ],
    patterns: [
      /\b(log|record|track|submit|file|add) (an? |the )?(expense|receipt|reimbursement)\b/i,
      /\b(i spent|i paid|i purchased|we spent)\b/i,
      /\b(₹|rs\.?|inr|usd|\$|£|€)\s*[\d,]+/i,
    ]
  },

  {
    capabilityId: 'core.candidate_interview',
    priority: 88,
    keywords: [
      'interview', 'candidate', 'applicant', 'screening', 'hiring',
      'recruiter', 'recruiting', 'hr round', 'technical round', 'panel interview',
      'shortlisted', 'interviewee', 'job interview', 'coding interview',
      'interview slot', 'interview invite', 'send interview link',
    ],
    patterns: [
      /\b(schedule|arrange|set up|book) (a |an |the )?(interview|screening|round)\b/i,
      /\b(candidate|applicant) (interview|call|screening)\b/i,
    ]
  },

  {
    capabilityId: 'core.document',
    priority: 85,
    keywords: [
      'document', 'doc', 'report', 'proposal', 'brief', 'memo',
      'contract', 'agreement', 'nda', 'sow', 'statement of work',
      'rfp', 'rfi', 'press release', 'white paper', 'draft',
      'write up', 'prepare a document', 'create a report',
      'meeting minutes', 'status report', 'project proposal',
      'letter of intent', 'letter of offer', 'policy document',
    ],
    patterns: [
      /\b(create|write|draft|generate|prepare) (a |an |the )?(document|doc|report|proposal|memo|contract|agreement)\b/i,
      /\bmeeting (minutes|notes|summary)\b/i,
      /\bnda\b/i,
    ]
  },

  {
    capabilityId: 'core.email',
    priority: 80,
    keywords: [
      'email', 'send email', 'draft email', 'write email',
      'compose email', 'mail', 'send mail', 'shoot an email',
      'reply to email', 'forward email', 'cc', 'bcc',
    ],
    patterns: [
      /\b(send|draft|write|compose|reply to|forward) (an? |the )?(email|mail)\b/i,
      /\bshoot (him|her|them|the team) an? email\b/i,
    ]
  },

  {
    capabilityId: 'core.calendar_event',
    priority: 78,
    keywords: [
      'add to calendar', 'put on calendar', 'calendar event',
      'block time', 'block the day', 'block my calendar',
      'calendar invite', 'calendar entry', 'save the date',
      'recurring event', 'out of office', 'ooo', 'day off', 'holiday',
      'birthday', 'anniversary',
    ],
    patterns: [
      /\b(add|create|put|block|mark) .{0,20}(calendar|cal|schedule|diary)\b/i,
      /\bblock (out |off )?(time|my calendar|the day)\b/i,
      /\b(out of office|ooo|away) (from|on|for)\b/i,
    ]
  },

  {
    capabilityId: 'core.call',
    priority: 75,
    keywords: [
      'call', 'ring', 'phone', 'dial', 'buzz', 'give a call',
      'make a call', 'place a call', 'conference call', 'group call',
      'phone call', 'voice call', 'on the phone',
    ],
    patterns: [
      /\b(call|ring|phone|dial|buzz) (him|her|them|john|sarah|the team|the client)\b/i,
      /\bgive (him|her|them|someone) a (call|ring|buzz)\b/i,
      /\b(make|place|initiate) a (call|phone call)\b/i,
    ]
  },

  {
    capabilityId: 'core.follow_up',
    priority: 72,
    keywords: [
      'follow up', 'follow-up', 'follow back', 'circle back',
      'chase', 'still waiting', 'no response', 'no reply',
      'pending response', 'awaiting response', 'nudge',
      'hasn\'t replied', 'hasn\'t responded', 'resend',
    ],
    patterns: [
      /\bfollow[- ]?up (with|on|about|to)\b/i,
      /\b(still waiting|waiting) (for|on) (a |the )?(reply|response|answer)\b/i,
      /\bno (response|reply) (from|yet)\b/i,
    ]
  },

  {
    capabilityId: 'core.meeting',
    priority: 70,
    keywords: [
      'meeting', 'meet', 'schedule meeting', 'book meeting',
      'zoom', 'google meet', 'teams', 'webex', 'catch up',
      'standup', 'stand-up', 'sync', '1-on-1', 'one on one',
      'review meeting', 'check in', 'team sync', 'team meeting',
      'all hands', 'town hall', 'retrospective', 'retro',
      'sprint planning', 'sprint review', 'let\'s meet',
    ],
    patterns: [
      /\b(schedule|arrange|set up|book) (a |the )?(meeting|call|zoom|session|sync)\b/i,
      /\blet('?s| us) (meet|connect|sync|catch up)\b/i,
    ]
  },

  {
    capabilityId: 'core.note',
    priority: 65,
    keywords: [
      'note', 'notes', 'jot', 'jot down', 'write down',
      'memo', 'take a note', 'make a note', 'save this',
      'capture this', 'remember this', 'brain dump',
      'for the record', 'quick note', 'save note', 'log note',
    ],
    patterns: [
      /\b(take|make|jot|write|save|capture) (a |quick |brief )?(note|memo|thought|idea)\b/i,
      /\bremember (this|that|the following)\b/i,
    ]
  },

  {
    capabilityId: 'core.checklist',
    priority: 62,
    keywords: [
      'checklist', 'check list', 'to-do list', 'todo list',
      'task list', 'shopping list', 'grocery list', 'packing list',
      'list of tasks', 'action list', 'list of things',
      'step by step', 'steps to', 'items to',
    ],
    patterns: [
      /\b(create|make|build|write) (a |the )?(checklist|to[- ]?do list|task list|shopping list)\b/i,
      /\blist (of|out) (things|tasks|items|steps)\b/i,
    ]
  },

  {
    capabilityId: 'core.reminder',
    priority: 60,
    keywords: [
      'remind me', 'reminder', 'remind', 'alarm', 'alert',
      'ping me', 'notify me', 'don\'t let me forget',
      'wake me up', 'heads up', 'in 5 minutes', 'in 10 minutes',
      'every day', 'every morning', 'every friday', 'every week',
    ],
    patterns: [
      /\bremind me\b/i,
      /\bset (a |an )?(reminder|alarm|alert)\b/i,
      /\b(ping|alert|notify|buzz) me (at|in|before|after|on)\b/i,
    ]
  },

  {
    capabilityId: 'core.contact',
    priority: 55,
    keywords: [
      'contact', 'save contact', 'add contact', 'phone number',
      'save number', 'store number', 'address book', 'phonebook',
    ],
    patterns: [
      /(\+?(\d[\s\-.]?){9,}\d)/,
      /\b[\w.+\-]+@[\w\-]+\.[a-z]{2,6}\b/i,
      /\b(save|add|store|record) (a |the )?(contact|number|phone)\b/i,
    ]
  },

  // Task is the last resort — only wins if nothing more specific matched
  {
    capabilityId: 'core.task',
    priority: 10,
    keywords: [
      'task', 'todo', 'to-do', 'to do', 'action item',
      'need to do', 'have to do', 'must do', 'should do',
      'assign task', 'create task',
    ],
    patterns: [
      /\b(todo|to-do|to do):?\s+\w+/i,
      /\b(action item|action required|assigned to)\b/i,
      /\bcreate (a |the |an )?(task|ticket|issue)\b/i,
    ]
  },
];

export class CommitmentPlannerImpl {
  private static instance: CommitmentPlannerImpl;

  private constructor() {}

  public static getInstance(): CommitmentPlannerImpl {
    if (!CommitmentPlannerImpl.instance) {
      CommitmentPlannerImpl.instance = new CommitmentPlannerImpl();
    }
    return CommitmentPlannerImpl.instance;
  }

  /**
   * Routes an Intent to the best Capability using scored matching.
  /**
   * Routes an Intent to the best Capability using scored matching.
   * Each routing rule accumulates a score from keyword and pattern hits.
   * The rule with the highest (score * priority) wins.
   */
  public async plan(rawIntent: Intent): Promise<Commitment | null> {
    // Phase 1: Context Resolution Pipeline Hydration
    const { hydratedIntent, trace } = await contextResolutionPipeline.hydrate(rawIntent);
    const intent = hydratedIntent;
    
    // In production, we can log the `trace` to the Kernel Dashboard here.
    console.log(`[CommitmentPlanner] Hydration complete. Trace steps: ${trace.length}`);

    const text = (intent.action || '').toLowerCase();
    console.log(`[CommitmentPlanner] Planning intent: "${intent.action}"`);

    let bestCapabilityId: string | null = null;
    let bestScore = 0;

    for (const rule of ROUTING_TABLE) {
      let score = 0;

      // Keyword scoring
      for (const kw of rule.keywords) {
        if (text.includes(kw.toLowerCase())) {
          score += 1;
        }
      }

      // Pattern scoring (worth 2 each — more specific)
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          score += 2;
        }
      }

      if (score === 0) continue;

      // Weight score by priority so higher-priority rules win ties
      const weightedScore = score * rule.priority;
      console.log(`[CommitmentPlanner] ${rule.capabilityId}: raw=${score}, weighted=${weightedScore}`);

      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestCapabilityId = rule.capabilityId;
      }
    }

    // Fall back to task if nothing matched at all
    if (!bestCapabilityId) {
      console.warn(`[CommitmentPlanner] No match found — defaulting to core.task`);
      bestCapabilityId = 'core.task';
    }

    const capability = capabilityRegistry.getCapability(bestCapabilityId);
    if (!capability) {
      console.warn(`[CommitmentPlanner] Capability ${bestCapabilityId} not registered`);
      return null;
    }

    console.log(`[CommitmentPlanner] Routed to: ${bestCapabilityId} (score=${bestScore})`);

    const commitment: Commitment = {
      id: crypto.randomUUID(),
      type: capability.manifest.name,
      capability: capability.manifest.id,
      status: 'detected',
      title: intent.entities?.title || intent.action,
      description: intent.entities?.description,
      schedule: intent.entities?.time ? { raw: intent.entities.time, resolved: intent.entities.time } : undefined,
      createdAt: Date.now(),
      confidence: intent.confidence ?? 0.8,
    };

    eventBus.publish('chatr:commitment-planned', { intent, commitment }, 'CommitmentPlanner');
    return commitment;
  }
}

export const commitmentPlanner = CommitmentPlannerImpl.getInstance();
