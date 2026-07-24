/**
 * CHATR Intent OS — Knowledge Engine
 *
 * Extracts structured knowledge from any text string:
 * - People (names, @mentions)
 * - Dates & times (natural language → ISO)
 * - Topics & keywords
 * - Intent signals
 * - Companies
 *
 * 100% in-browser — no external API call.
 */

export interface ExtractedKnowledge {
  people: string[];
  dates: string[];           // ISO strings
  dateLabels: string[];      // Human readable: "Tomorrow", "2 PM"
  topics: string[];
  companies: string[];
  intents: string[];         // e.g. "meeting", "reminder", "payment"
  rawText: string;
  confidence: number;
  extractedAt: string;       // ISO
}

// Intent signal patterns
const INTENT_PATTERNS: Record<string, RegExp[]> = {
  meeting:   [/\b(meeting|call|sync|standup|catchup|discuss|schedule)\b/i],
  reminder:  [/\b(remind|reminder|don't forget|remember|alert)\b/i],
  task:      [/\b(task|todo|to-do|to do|action item|needs to|complete)\b/i],
  expense:   [/\b(expense|bill|invoice|pay|payment|₹|\$|rupee|usd|amount)\b/i],
  flight:    [/\b(flight|fly|book flight|travel|airport|depart|arrive)\b/i],
  hotel:     [/\b(hotel|stay|check in|check out|accommodation|book room)\b/i],
  email:     [/\b(email|send mail|write to|message|reply)\b/i],
  document:  [/\b(document|doc|create file|draft|write up|report|proposal|contract)\b/i],
  interview: [/\b(interview|candidate|hire|recruit|screening|assessment)\b/i],
  followup:  [/\b(follow up|follow-up|check in|ping|reach out)\b/i],
};

// Time expression resolver
function resolveTimeExpression(expr: string): { iso: string; label: string } | null {
  const now = new Date();
  const lower = expr.toLowerCase().trim();

  const patterns: [RegExp, () => Date][] = [
    [/\bnow\b/, () => new Date()],
    [/\btoday\b/, () => { const d = new Date(now); d.setHours(9, 0, 0, 0); return d; }],
    [/\btomorrow\b/, () => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; }],
    [/\bnext week\b/, () => { const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; }],
    [/\bmonday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\btuesday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\bwednesday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\bthursday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\bfriday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\bsaturday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\bsunday\b/, () => { const d = new Date(now); d.setDate(d.getDate() + ((0 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; }],
    [/\b(\d{1,2})\s*(am|pm)\b/i, () => {
      const match = lower.match(/\b(\d{1,2})\s*(am|pm)\b/i);
      if (!match) return now;
      let hour = parseInt(match[1]);
      if (match[2].toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (match[2].toLowerCase() === 'am' && hour === 12) hour = 0;
      const d = new Date(now);
      d.setHours(hour, 0, 0, 0);
      if (d < now) d.setDate(d.getDate() + 1);
      return d;
    }],
    [/\b(\d{1,2}):(\d{2})\b/, () => {
      const match = lower.match(/\b(\d{1,2}):(\d{2})\b/);
      if (!match) return now;
      const d = new Date(now);
      d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
      if (d < now) d.setDate(d.getDate() + 1);
      return d;
    }],
  ];

  for (const [pattern, resolver] of patterns) {
    if (pattern.test(lower)) {
      const date = resolver();
      return {
        iso: date.toISOString(),
        label: formatDateLabel(date, expr),
      };
    }
  }
  return null;
}

function formatDateLabel(date: Date, original: string): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (isTomorrow) return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// People name extraction (basic NER — capitalized words that aren't sentence starters)
function extractPeople(text: string): string[] {
  const people = new Set<string>();

  // @mentions
  const mentions = text.match(/@([A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)?)/g) || [];
  mentions.forEach(m => people.add(m.replace('@', '')));

  // "with Name" or "for Name" patterns
  const withPattern = /\b(?:with|for|from|to|by|invite|called?|email(?:ing)?|meet(?:ing)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  let match;
  while ((match = withPattern.exec(text)) !== null) {
    people.add(match[1]);
  }

  // Capitalized proper-noun sequences (at least 2 letters, not common words)
  const COMMON_WORDS = new Set(['The', 'This', 'That', 'They', 'There', 'Today', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'New', 'Old', 'Next', 'Last', 'First', 'Second', 'Send', 'Make', 'Take', 'Create', 'Add', 'Check', 'Call', 'Book', 'Note', 'Task', 'Meet', 'Remind', 'Set', 'Get', 'Go', 'Show', 'Find', 'Please', 'CHATR', 'Email', 'Phone', 'File', 'Team', 'Work', 'Project', 'Schedule']);
  const words = text.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const word = words[i].replace(/[^A-Za-z]/g, '');
    if (word.length >= 2 && /^[A-Z][a-z]+$/.test(word) && !COMMON_WORDS.has(word)) {
      people.add(word);
    }
  }

  return Array.from(people).slice(0, 5);
}

// Topic extraction (keywords)
function extractTopics(text: string): string[] {
  const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'through', 'and', 'or', 'but', 'if', 'then', 'this', 'that', 'it', 'its', 'my', 'me', 'we', 'us', 'you', 'he', 'she', 'they', 'i', 'am', 'need', 'want', 'get', 'go', 'make', 'just', 'also', 'too', 'very']);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 6);
}

// Company extraction
function extractCompanies(text: string): string[] {
  const companies = new Set<string>();
  const patterns = [
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:Inc|Ltd|Corp|LLC|Pvt|Pte|Co|Group|Technologies|Tech|Solutions|Services|Consulting|Ventures|Capital|Labs?|Studio|Agency)\b/g,
    /\b@([a-zA-Z][a-zA-Z0-9_]+)\b/g,  // social handles as company refs
  ];

  patterns.forEach(p => {
    let m;
    while ((m = p.exec(text)) !== null) companies.add(m[1]);
  });

  return Array.from(companies).slice(0, 3);
}

export class KnowledgeEngine {
  private static instance: KnowledgeEngine;

  private constructor() {}

  public static getInstance(): KnowledgeEngine {
    if (!KnowledgeEngine.instance) {
      KnowledgeEngine.instance = new KnowledgeEngine();
    }
    return KnowledgeEngine.instance;
  }

  /**
   * Extract all structured knowledge from a text string.
   * Called on every message sent or received.
   */
  public extract(text: string): ExtractedKnowledge {
    if (!text || text.trim().length < 3) {
      return {
        people: [], dates: [], dateLabels: [], topics: [],
        companies: [], intents: [], rawText: text,
        confidence: 0, extractedAt: new Date().toISOString()
      };
    }

    // People
    const people = extractPeople(text);

    // Date expressions
    const dateExpressions = text.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2})\b/gi) || [];
    const resolvedDates = dateExpressions
      .map(e => resolveTimeExpression(e))
      .filter(Boolean) as { iso: string; label: string }[];

    // Topics
    const topics = extractTopics(text);

    // Companies
    const companies = extractCompanies(text);

    // Intents
    const intents: string[] = [];
    Object.entries(INTENT_PATTERNS).forEach(([intent, patterns]) => {
      if (patterns.some(p => p.test(text))) {
        intents.push(intent);
      }
    });

    // Confidence: scales with # of extracted items
    const itemCount = people.length + resolvedDates.length + intents.length;
    const confidence = Math.min(0.95, itemCount * 0.15 + 0.2);

    return {
      people,
      dates: resolvedDates.map(d => d.iso),
      dateLabels: resolvedDates.map(d => d.label),
      topics,
      companies,
      intents,
      rawText: text,
      confidence,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Merge multiple knowledge extractions (accumulate across messages)
   */
  public merge(existing: ExtractedKnowledge, incoming: ExtractedKnowledge): ExtractedKnowledge {
    const unique = <T>(arr: T[]) => Array.from(new Set(arr));
    return {
      people: unique([...existing.people, ...incoming.people]).slice(0, 8),
      dates: unique([...existing.dates, ...incoming.dates]).slice(0, 5),
      dateLabels: unique([...existing.dateLabels, ...incoming.dateLabels]).slice(0, 5),
      topics: unique([...existing.topics, ...incoming.topics]).slice(0, 10),
      companies: unique([...existing.companies, ...incoming.companies]).slice(0, 5),
      intents: unique([...existing.intents, ...incoming.intents]),
      rawText: existing.rawText + ' ' + incoming.rawText,
      confidence: Math.max(existing.confidence, incoming.confidence),
      extractedAt: new Date().toISOString(),
    };
  }
}

export const knowledgeEngine = KnowledgeEngine.getInstance();
