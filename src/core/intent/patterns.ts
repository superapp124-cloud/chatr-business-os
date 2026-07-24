/**
 * CHATR Intent Observer — Client-side Pattern Engine
 *
 * Genesis v1.0 — Prompt Library Edition
 *
 * 750+ utterances across 15 capabilities.
 * Priority order matters: more specific capabilities are checked BEFORE generic ones.
 * FLIGHT_BOOKING must be checked before TASK, or "I need to fly" will be classified as TASK.
 *
 * 5-Second Rule: This runs in < 1ms.
 */

import type { Understanding, IntentType } from './types';

/**
 * Pattern definitions with priority.
 * Higher priority = checked first. Prevents generic patterns from swallowing specific ones.
 */
const PATTERN_DEFINITIONS: { type: IntentType; priority: number; patterns: RegExp[] }[] = [

  // ─── FLIGHT BOOKING (priority 100) ───────────────────────────────────────────
  // Must be above TASK/REMINDER to prevent "I need to fly" → TASK
  {
    type: 'FLIGHT_BOOKING',
    priority: 100,
    patterns: [
      /\bbook (a |the |me a |us a )?(flight|plane ticket|air ticket|ticket)\b/i,
      /\b(i need to|i want to|can you|please|i'd like to|i have to|i must) fly\b/i,
      /\bfly (me |us )?(to|from|via)\b/i,
      /\b(flight|flights) (to|from|back to|returning to|for)\b/i,
      /\bget (me |us )?(a |the )?(flight|plane|ticket|air ticket)\b/i,
      /\b(return|round[- ]?trip|one[- ]?way) (flight|ticket)\b/i,
      /\b(morning|evening|afternoon|night|early|late) flight\b/i,
      /\b(cheapest|cheapest available|economy|business class|first class) (flight|ticket)\b/i,
      /\bbook (emirates|indigo|air india|etihad|qatar|british airways|lufthansa|united|delta|american airlines)\b/i,
      /\b(travel|flying|departing) (to|from|via) \w+/i,
      /\bair ticket to\b/i,
      /\bi need a (flight|ticket) (to|from)\b/i,
      /\bflight on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\bnext (flight|available flight)\b/i,
      /\b(departing|arriving|landing) (tomorrow|next week|on monday|on friday)\b/i,
      /\bpassage to \w+/i,
      /\bcheap (flights|airfare)\b/i,
      /\bairfare (to|from)\b/i,
      /\bplane (ticket|ride) (to|from)\b/i,
    ]
  },

  // ─── HOTEL BOOKING (priority 95) ─────────────────────────────────────────────
  {
    type: 'HOTEL_BOOKING',
    priority: 95,
    patterns: [
      /\bbook (a |the |me a |us a )?(hotel|room|suite|accommodation|stay|hostel|airbnb)\b/i,
      /\b(find|search|get) (me |us )?(a |the )?(hotel|room|place to stay|accommodation)\b/i,
      /\b(hotel|accommodation|room) (in|near|at|for|close to)\b/i,
      /\b(stay|staying|check[- ]?in|check[- ]?out) (at|in|near)\b/i,
      /\bi need (a hotel|accommodation|a room|a place to stay|somewhere to sleep)\b/i,
      /\b(one night|two nights|3 nights|4 nights|a week) (at|in|near|close to) \w+/i,
      /\b(3|4|5)[- ]?star hotel\b/i,
      /\b(marriott|hilton|hyatt|sheraton|westin|holiday inn|ibis|radisson|novotel|taj|oberoi|itc)\b/i,
      /\breserve (a |the )?(room|hotel|suite)\b/i,
      /\bwhere (to|should i|can i) stay (in|near|at)\b/i,
      /\b(budget|luxury|cheap|affordable|boutique) hotel\b/i,
      /\bnearby (hotel|accommodation|place to stay)\b/i,
      /\bhotel (near|in|at|for) (the |an?|my )?\w+/i,
      /\broom (for|from|booking|reservation)\b/i,
    ]
  },

  // ─── EXPENSE (priority 90) ────────────────────────────────────────────────────
  {
    type: 'EXPENSE',
    priority: 90,
    patterns: [
      /\b(log|record|track|add|submit|file) (an? |the |this )?(expense|receipt|reimbursement|claim)\b/i,
      /\b(i spent|i paid|i bought|i purchased|we spent|we paid)\b/i,
      /\b(expense|reimbursement|receipt|bill|invoice) (report|claim|request|submission)\b/i,
      /\b(claim|request) (reimbursement|refund|expenses?)\b/i,
      /\b(₹|rs\.?|inr|usd|\$|£|€)\s*[\d,]+(\.\d{2})?\b/i,
      /\b[\d,]+(\.\d{2})?\s*(₹|rs\.?|inr|usd|\$|£|€)\b/i,
      /\b(dinner|lunch|breakfast|cab|taxi|uber|ola|flight|hotel) (was|cost|costs|came to|amounted to|bill)\b/i,
      /\bpetty cash\b/i,
      /\bout[- ]?of[- ]?pocket (expense|cost|payment)\b/i,
      /\b(client|business|travel) (expense|meal|entertainment)\b/i,
      /\breceipt (for|from|of)\b/i,
      /\bpaid (for|from|out of)\b/i,
      /\bspent [\d,]+\b/i,
      /\b(add|enter|record) (a |this )?(purchase|payment|transaction)\b/i,
      /\b(corporate|company) card (expense|transaction)\b/i,
    ]
  },

  // ─── CANDIDATE INTERVIEW (priority 88) ───────────────────────────────────────
  {
    type: 'CANDIDATE_INTERVIEW',
    priority: 88,
    patterns: [
      /\b(schedule|arrange|set up|book|organize) (a |an |the )?(interview|screening|round|hr round|technical round|panel)\b/i,
      /\b(candidate|applicant|shortlisted) (interview|screening|call|round)\b/i,
      /\b(interview|meet) the (candidate|applicant|shortlisted (person|individual))\b/i,
      /\b(first|second|third|final|hr|technical|behavioral|cultural fit) (interview|round|stage)\b/i,
      /\bhiring (interview|pipeline|round)\b/i,
      /\b(phone|video|in[- ]?person|on[- ]?site) (interview|screening)\b/i,
      /\binterview (for|the|a|an) (developer|engineer|designer|manager|analyst|intern)\b/i,
      /\bcandidate (is|has been|was) (shortlisted|selected|chosen|invited)\b/i,
      /\brecruiting (call|interview|meeting)\b/i,
      /\bsend (an |a )?(interview|screening) (invite|invitation|link|slot)\b/i,
      /\b(coding|case|group) interview\b/i,
      /\bpanel (discussion|interview|review)\b/i,
      /\binterview (slot|time|schedule|availability)\b/i,
    ]
  },

  // ─── DOCUMENT (priority 85) ──────────────────────────────────────────────────
  {
    type: 'DOCUMENT',
    priority: 85,
    patterns: [
      /\b(create|write|draft|generate|prepare|make|produce|compose) (a |an |the )?(document|doc|report|proposal|brief|memo|contract|agreement|nda|sow|rfi|rfp|pr|press release|white paper)\b/i,
      /\b(draft|write up|write out) (a |an |the )?(email|letter|message|summary|minutes|notes|announcement|blog|post)\b/i,
      /\b(generate|create|produce) (a |an |the )?(template|boilerplate|outline|framework|structure)\b/i,
      /\b(legal|official|formal) (document|letter|notice|agreement)\b/i,
      /\b(policy|procedure|sop|standard operating procedure)\b/i,
      /\b(meeting|project|status) (minutes|notes|report|summary)\b/i,
      /\bproject (proposal|brief|plan|charter|scope|overview)\b/i,
      /\bnda\b/i,
      /\b(statement of work|sow)\b/i,
      /\b(letter of (intent|offer|recommendation|introduction))\b/i,
      /\bwrite (me |us )?(a |an )?\w+ (document|report|letter|note|memo)\b/i,
      /\b(generate|produce) (a |an )?(invoice|quote|estimate|proposal)\b/i,
    ]
  },

  // ─── EMAIL (priority 80) ─────────────────────────────────────────────────────
  {
    type: 'EMAIL',
    priority: 80,
    patterns: [
      /\b(send|draft|write|compose|prepare|reply to|forward) (an? |the )?(email|mail|message)\b/i,
      /\b(email|mail) (him|her|them|john|sarah|the team|the client|the customer)\b/i,
      /\bi'll (email|mail|message|write) (him|her|them|you|the team|the client)\b/i,
      /\bshoot (him|her|them|you|the team) (an |a )?(email|mail|message)\b/i,
      /\b(follow[- ]?up|respond|reply) (via |by |through )?(email|mail)\b/i,
      /\bsend (an? )?(email|mail) (to|regarding|about|for|with)\b/i,
      /\b(cc|bcc|copy) (him|her|them|the team)\b/i,
      /\b(email|message) (the team|management|hr|client|customer|stakeholders)\b/i,
      /\bsend (him|her|them|the team) (a |an |the )?(update|summary|proposal|invoice|quote)\b/i,
      /\blet (him|her|them|the team) know (via email|by email|over email)\b/i,
      /\bemail (confirmation|update|reminder|notification)\b/i,
      /\b(mass|bulk|broadcast) email\b/i,
    ]
  },

  // ─── CALENDAR EVENT (priority 78) ────────────────────────────────────────────
  {
    type: 'CALENDAR_EVENT',
    priority: 78,
    patterns: [
      /\b(add|create|put|block|mark|set) (it |this )?(on|in|to) (the |my |our )?(calendar|cal|schedule|diary)\b/i,
      /\b(calendar|cal) (event|invite|block|entry|slot)\b/i,
      /\bblock (out |off )?(time|my calendar|the calendar|the day|the morning|the afternoon)\b/i,
      /\bblock (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(add|create|set) (a |an )?(recurring|weekly|monthly|daily|annual) (event|meeting|session)\b/i,
      /\b(add|put|create) (a |an )?(birthday|anniversary|holiday|vacation|day off|out of office)\b/i,
      /\bblock (my|the) (morning|afternoon|evening|day) (for|on)\b/i,
      /\bmark (me|myself|the team) (as |)(out|unavailable|busy|away|ooo)\b/i,
      /\b(add|create|set) (a |an )(reminder|alert|notification) (in|on|to) (the )?calendar\b/i,
      /\bsave (this |the )?(date|event|session|appointment)\b/i,
      /\bput (this|it|that) (in|on) (my |the )?(calendar|schedule|diary)\b/i,
      /\b(out of office|ooo|away) (from|on|for)\b/i,
    ]
  },

  // ─── CALL (priority 75) ──────────────────────────────────────────────────────
  {
    type: 'CALL',
    priority: 75,
    patterns: [
      /\b(call|ring|phone|dial|buzz|ping) (him|her|them|john|sarah|the team|the client|the customer)\b/i,
      /\bgive (him|her|them|john|sarah) a (call|ring|buzz|missed call)\b/i,
      /\b(i'll|i will|let me|please) (call|ring|phone|dial|buzz) (him|her|them|you|the team|the office)\b/i,
      /\b(make|place|initiate) (a |the )?(call|phone call|video call|voice call)\b/i,
      /\b(conference|group|team|client|customer) call\b/i,
      /\b(get on|hop on|join) (a |the )?(call|phone|line)\b/i,
      /\bset up (a |the )?(call|phone call)\b/i,
      /\b(call|dial|phone) (the |my |their )?(office|number|extension|landline|mobile)\b/i,
      /\b(quick|brief|30[- ]?min) call\b/i,
      /\b(reach|get) (him|her|them|the team|the client|you) (on|via|by) (phone|call)\b/i,
      /\bfollow[- ]?up (call|phone call)\b/i,
      /\bcatch (him|her|them) (on|via) (phone|call)\b/i,
    ]
  },

  // ─── FOLLOW_UP (priority 72) ─────────────────────────────────────────────────
  {
    type: 'FOLLOW_UP',
    priority: 72,
    patterns: [
      /\bfollow[- ]?up (with|on|about|regarding|to)\b/i,
      /\b(check|chase|follow) (back|up) (with|on|about|to)\b/i,
      /\bneed to (follow|circle|get) (back|up|around) (to|with|on)\b/i,
      /\b(i'll|i will) (follow|circle) (up|back) (with|on|to)\b/i,
      /\bpending (follow[- ]?up|response|reply|decision|action)\b/i,
      /\b(still waiting|waiting) (for|on) (a |the )?(reply|response|answer|decision|update|confirmation)\b/i,
      /\bno (response|reply|update|word|news) (from|yet)\b/i,
      /\b(nudge|ping|remind) (him|her|them|the team) (again|once more|to respond|for an update)\b/i,
      /\bif (i|we) (don't|dont|haven't|havent) (hear|get|receive) (back|a reply|a response|an update)\b/i,
      /\bhasn'?t (replied|responded|gotten back)\b/i,
      /\b(re|resend|resending) (the |my |our )?(email|message|request|proposal|quote)\b/i,
      /\b(awaiting|still awaiting) (approval|confirmation|response|feedback|sign[- ]?off)\b/i,
    ]
  },

  // ─── MEETING (priority 70) ───────────────────────────────────────────────────
  {
    type: 'MEETING',
    priority: 70,
    patterns: [
      /\blet('?s| us) (meet|get together|connect|sync|catch up)\b/i,
      /\bmeet (you|him|her|them|up)? ?(at|tomorrow|today|on|next|this|monday|tuesday|wednesday|thursday|friday)\b/i,
      /\b(schedule|arrange|set up|book|organize|plan) (a |the )?(meeting|call|zoom|catch[- ]?up|session|standup|sync|discussion|review|check[- ]?in|1[- ]?on[- ]?1|one[- ]?on[- ]?one)\b/i,
      /\b(coffee|lunch|dinner|breakfast|tea) (with|tomorrow|today|next|this (morning|afternoon|evening|week)|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
      /\b(zoom|google meet|teams|webex|skype|loom) (call|meeting|session)\b/i,
      /\bcatch[- ]?up (tomorrow|next|this|on|with)\b/i,
      /\bmeet(ing)? at \d{1,2}(:\d{2})?\s*(am|pm)?\b/i,
      /\bjoin (me|us)? ?(for|on|at)? ?(a |the )?(call|meeting|session|sync)\b/i,
      /\bteam (sync|meeting|standup|stand[- ]?up|check[- ]?in|huddle)\b/i,
      /\b(weekly|daily|monthly|quarterly|biweekly|fortnightly) (meeting|sync|standup|call|review|check[- ]?in)\b/i,
      /\b(customer|client|stakeholder|vendor|partner) (meeting|call|review|session)\b/i,
      /\b(all[- ]?hands|town hall|town[- ]?hall|all[- ]?staff) (meeting|call|session)\b/i,
      /\b(board|executive|management|leadership) (meeting|review|session)\b/i,
      /\bgather (the |my |our )?(team|group|people)\b/i,
      /\b(retrospective|retro|sprint review|sprint planning|backlog) (meeting|session|call)\b/i,
    ]
  },

  // ─── NOTE (priority 65) ──────────────────────────────────────────────────────
  {
    type: 'NOTE',
    priority: 65,
    patterns: [
      /\b(make|take|jot|write|save|capture|record|keep) (a |this |some |quick |brief |short )?(note|notes|jot|memo|thought|idea|observation|insight)\b/i,
      /\b(note|notes|write[- ]?down|jot[- ]?down|write up) (this|that|the following|the above|what i said)\b/i,
      /\bremember (that|this|the following|what i said|what we said|the idea)\b/i,
      /\b(don't|do not) (let me |)(forget|lose) (this|that|the idea|the thought)\b/i,
      /\bpin (this|that|the message|the idea)\b/i,
      /\b(important|key|critical) (note|point|observation|finding|insight)\b/i,
      /\b(brain|thought) dump\b/i,
      /\b(capture|document|log) (this|the|that) (conversation|discussion|thought|idea|insight|decision|outcome)\b/i,
      /\b(add a|create a|save this as a) note\b/i,
      /\bquick (note|thought|reminder|observation)\b/i,
      /\bi had (an idea|a thought|a suggestion)\b/i,
      /\bfor the record\b/i,
    ]
  },

  // ─── CHECKLIST (priority 62) ─────────────────────────────────────────────────
  {
    type: 'CHECKLIST',
    priority: 62,
    patterns: [
      /\b(create|make|build|start|set up|prepare|write) (a |the )?(checklist|check list|to[- ]?do list|task list|list of tasks|action list|punch list|shopping list|grocery list|packing list|bucket list)\b/i,
      /\b(add|include|put) (it |this |that |these items |the following )?on (the |a |my |our )?(checklist|list|to[- ]?do)\b/i,
      /\blist (of|for|out) (things|tasks|items|steps|actions|requirements|criteria)\b/i,
      /\b(things|items|tasks|steps) (to|we need to|i need to) (do|complete|check|verify|cover|go through)\b/i,
      /\bstep[- ]?by[- ]?step (process|guide|instructions|checklist)\b/i,
      /\b(pre[- ]?flight|pre[- ]?launch|pre[- ]?meeting|pre[- ]?event|onboarding|offboarding|handover) checklist\b/i,
      /\b(quality|compliance|audit|security|safety) checklist\b/i,
      /\btick (off|all|each|these)\b/i,
      /\b(shopping|packing|grocery|moving|travel) list\b/i,
      /\b(don't miss|make sure we|make sure you|make sure i) (cover|include|check)\b/i,
      /\b(requirements|criteria|conditions) (list|checklist|for)\b/i,
    ]
  },

  // ─── REMINDER (priority 60) ──────────────────────────────────────────────────
  {
    type: 'REMINDER',
    priority: 60,
    patterns: [
      /\bremind me\b/i,
      /\bset (a |an )?(reminder|alarm|alert|ping|notification)\b/i,
      /\b(ping|alert|notify|buzz) me (at|in|on|before|after|when|if|tomorrow|next)\b/i,
      /\bdon'?t (let me |)(forget|miss) (to|about|the|this|that|my)\b/i,
      /\bwake me (up)? at\b/i,
      /\bgive me (a |an )?(heads[- ]?up|reminder|nudge|alert|ping) (at|before|when|on|if)\b/i,
      /\b(alarm|alert|notification) (at|for|on|before)\b/i,
      /\b(remind|alert|ping|nudge) (me|us|the team) (at|before|when|every|tomorrow|next|in \d+)\b/i,
      /\bif (i|we) (forget|miss|don't|don't do|haven't done)\b/i,
      /\bin (5|10|15|20|30|45|60) (minutes|mins|hours|hrs)\b/i,
      /\bevery (day|morning|evening|night|monday|week|friday|month)\b/i,
      /\b(before|after) (the meeting|lunch|dinner|my call|work|end of day|eod)\b/i,
      /\b(eod|end of day|eow|end of week) (reminder|alert)\b/i,
    ]
  },

  // ─── CONTACT (priority 55) ───────────────────────────────────────────────────
  {
    type: 'CONTACT',
    priority: 55,
    patterns: [
      /(\+?(\d[\s\-.]?){9,}\d)/,
      /\b[\w.+\-]+@[\w\-]+\.[a-z]{2,6}\b/i,
      /\b(number|phone|email|whatsapp|contact|reach me|call me|mobile|cell) (is|at|:)\s*[\w\s@.+\-]{5,}/i,
      /\badd (me|him|her|them|john|sarah|the client) (to (your |the |my )?contacts|as a contact)\b/i,
      /\b(save|store|keep|record) (this |my |their |his |her |the )?(number|phone number|contact|email|details)\b/i,
      /\b(new |update |edit )?(contact|profile|record) (for|of|details)\b/i,
      /\b(my|his|her|their|the team's|the client's) (number|phone|email|details|contact) (is|are)\b/i,
      /\bhis (number|phone|email|contact) is\b/i,
      /\b(update|edit|change|correct) (my|his|her|their) (number|phone|email|contact|details)\b/i,
      /\badd (to|into) (the |my |the company |the team )?(address book|phonebook|contacts|crm)\b/i,
    ]
  },

  // ─── TASK (priority 40) — checked AFTER specific capabilities ─────────────────
  // This is the last specific classifier before the true fallback
  {
    type: 'TASK',
    priority: 40,
    patterns: [
      /\bi (need to|have to|must|got to|gotta|should) (do|complete|finish|handle|fix|prepare|review|submit|send|check|update|write|build|create|deploy|test|analyze|approve)\b/i,
      /\bwe (need to|have to|must|should) (do|complete|finish|handle|fix|prepare|review|submit|send|check|update)\b/i,
      /\b(todo|to-do|to do):?\s+\w+/i,
      /\b(action item|action required|assigned to|follow[- ]?up on|follow through on)\b/i,
      /\bby (end of (day|week|month)|tomorrow|friday|monday).{0,40}\b(done|complete|finished|ready|submitted)\b/i,
      /\b(get|make sure|ensure) (this|it|that|the) (is |)(done|complete|ready|finished|submitted|approved|reviewed)\b/i,
      /\b(don't|do not) (forget to|miss) (do|complete|finish|submit|send|reply|review|check|fix|update)\b/i,
      /\bassign (this|the task|the work|the issue|the bug|the ticket) (to|for)\b/i,
      /\b(ticket|issue|bug|work item|user story|backlog item) (for|to|regarding)\b/i,
      /\b(this|the) (task|work|job|item) (is|needs to be|should be|must be)\b/i,
      /\b(pending|outstanding|overdue|incomplete) (task|work|item|deliverable)\b/i,
      /\bcreate (a |the |an )?(task|ticket|issue|work item)\b/i,
    ]
  },
];

// ─── Sorted by priority (highest first) ──────────────────────────────────────
const SORTED_PATTERNS = [...PATTERN_DEFINITIONS].sort((a, b) => b.priority - a.priority);

export function detectIntents(messageText: string): Partial<Understanding>[] {
  if (!messageText || messageText.trim().length < 8) return [];

  const detections: Partial<Understanding>[] = [];
  const matchedTypes = new Set<IntentType>();

  for (const { type, patterns } of SORTED_PATTERNS) {
    let score = 0;
    const matched: string[] = [];

    for (const pattern of patterns) {
      const m = messageText.match(pattern);
      if (m) {
        score++;
        matched.push(m[0].substring(0, 60));
      }
    }

    if (score === 0) continue;

    // Don't double-report the same type
    if (matchedTypes.has(type)) continue;
    matchedTypes.add(type);

    // Higher score = higher confidence
    const observationConfidence = score === 1 ? 0.72 : score === 2 ? 0.87 : 0.96;

    detections.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      type,
      confidence: {
        observation: observationConfidence,
        meaning: 0.3,
        execution: 0
      },
      source: 'regex',
      readyForSuggestion: true
    });
  }

  // Sort by confidence descending
  return detections.sort((a, b) => (b.confidence?.observation || 0) - (a.confidence?.observation || 0));
}
