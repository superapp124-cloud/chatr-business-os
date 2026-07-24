/**
 * CHATR Intent OS — Global Context Engine
 *
 * Maps the current route to:
 * - AI mode (which persona the floating AI uses)
 * - Page-specific capabilities (what intents are most likely)
 * - Right panel mode
 * - Context label (what the user sees as "AI context")
 */

export type PageAIMode =
  | 'conversation'    // /desktop/chat
  | 'meeting-copilot' // /desktop/calls
  | 'relationship'    // /desktop/contacts
  | 'knowledge'       // /desktop/canvas
  | 'command-center'  // /desktop/smart-inbox
  | 'workspace'       // /desktop/workspace
  | 'recruitment'     // /desktop/recruitment
  | 'crm'             // /desktop/pro/business/crm
  | 'generic';        // everything else

export interface PageContext {
  route: string;
  aiMode: PageAIMode;
  aiLabel: string;
  aiDescription: string;
  aiEmoji: string;
  rightPanel: string;
  primaryCapabilities: string[];        // Which capabilities are most likely on this page
  intentSuggestions: string[];          // Suggested prompts shown in empty state
  accentColor: string;                  // HSL color for page theming
}

const PAGE_CONTEXT_MAP: Record<string, PageContext> = {
  '/desktop/chat': {
    route: '/desktop/chat',
    aiMode: 'conversation',
    aiLabel: 'Conversation AI',
    aiDescription: 'I understand your messages and detect commitments automatically.',
    aiEmoji: '💬',
    rightPanel: 'intelligence',
    primaryCapabilities: ['core.reminder', 'core.meeting', 'core.task', 'core.follow_up', 'core.note', 'core.expense'],
    intentSuggestions: [
      'Remind me to follow up with John tomorrow',
      'Schedule a meeting with the team Friday',
      'Create a task: Update the project specs',
      'Take a note: Q3 targets discussed',
      'Book a flight to Mumbai next Monday',
    ],
    accentColor: 'violet',
  },
  '/desktop/calls': {
    route: '/desktop/calls',
    aiMode: 'meeting-copilot',
    aiLabel: 'Meeting Copilot',
    aiDescription: 'I capture notes, decisions and action items during your calls.',
    aiEmoji: '🎙️',
    rightPanel: 'call-intelligence',
    primaryCapabilities: ['core.meeting', 'core.follow_up', 'core.task', 'core.reminder', 'core.note'],
    intentSuggestions: [
      'Start meeting with Rahul',
      'Schedule a call with the product team',
      'Follow up with client after call',
      'Create meeting notes for today',
      'Set a reminder for next call',
    ],
    accentColor: 'blue',
  },
  '/desktop/contacts': {
    route: '/desktop/contacts',
    aiMode: 'relationship',
    aiLabel: 'Relationship AI',
    aiDescription: 'I surface the full history of every person you work with.',
    aiEmoji: '🤝',
    rightPanel: 'relationship-history',
    primaryCapabilities: ['core.call', 'core.email', 'core.meeting', 'core.follow_up', 'core.task', 'core.reminder'],
    intentSuggestions: [
      'What happened with John last week?',
      'Call Rahul',
      'Email the proposal to TalentXcel',
      'Schedule a follow-up with Sarah',
      'Add a note about the client meeting',
    ],
    accentColor: 'emerald',
  },
  '/desktop/canvas': {
    route: '/desktop/canvas',
    aiMode: 'knowledge',
    aiLabel: 'Knowledge AI',
    aiDescription: 'I connect your people, meetings, documents and decisions into one graph.',
    aiEmoji: '🧠',
    rightPanel: 'knowledge-graph',
    primaryCapabilities: ['core.document', 'core.note', 'core.task', 'core.meeting'],
    intentSuggestions: [
      'Show everything involving Rahul and Budget',
      'Create a document: Project Roadmap Q3',
      'Link this meeting to Project Alpha',
      'Find all decisions made last week',
      'Show my pending tasks',
    ],
    accentColor: 'purple',
  },
  '/desktop/smart-inbox': {
    route: '/desktop/smart-inbox',
    aiMode: 'command-center',
    aiLabel: 'Command Center AI',
    aiDescription: 'I search across all your mail, messages, files, meetings and tasks.',
    aiEmoji: '📡',
    rightPanel: 'unified-search',
    primaryCapabilities: ['core.email', 'core.task', 'core.follow_up', 'core.reminder', 'core.document'],
    intentSuggestions: [
      'Where is Rahul\'s proposal?',
      'Show emails needing a reply',
      'Find all invoices from this month',
      'What tasks are overdue?',
      'Search for the product launch document',
    ],
    accentColor: 'cyan',
  },
  '/desktop/workspace': {
    route: '/desktop/workspace',
    aiMode: 'workspace',
    aiLabel: 'Workspace AI',
    aiDescription: 'I set up intelligent workspaces tailored to your industry.',
    aiEmoji: '🏗️',
    rightPanel: 'workspace-builder',
    primaryCapabilities: ['core.task', 'core.document', 'core.meeting', 'core.reminder', 'core.candidate_interview'],
    intentSuggestions: [
      'Create a Sales workspace',
      'Set up an HR workspace',
      'Build a project for Product Launch',
      'Create a task board for Q3',
      'Add a team workspace for Engineering',
    ],
    accentColor: 'orange',
  },
  '/desktop/recruitment': {
    route: '/desktop/recruitment',
    aiMode: 'recruitment',
    aiLabel: 'Recruitment AI',
    aiDescription: 'I help you track candidates, schedule interviews, and manage hiring.',
    aiEmoji: '🎯',
    rightPanel: 'recruitment-pipeline',
    primaryCapabilities: ['core.candidate_interview', 'core.task', 'core.email', 'core.document', 'core.reminder'],
    intentSuggestions: [
      'Schedule interview with React developer candidate',
      'Send offer letter to Priya',
      'Create a job posting for Senior Engineer',
      'Review today\'s interviews',
      'Follow up with candidate John',
    ],
    accentColor: 'pink',
  },
};

const DEFAULT_CONTEXT: PageContext = {
  route: '/',
  aiMode: 'generic',
  aiLabel: 'CHATR AI',
  aiDescription: 'I understand your intent and get work done.',
  aiEmoji: '⚡',
  rightPanel: 'generic',
  primaryCapabilities: ['core.reminder', 'core.task', 'core.note', 'core.meeting'],
  intentSuggestions: [
    'Remind me to...',
    'Schedule a meeting with...',
    'Create a task to...',
    'Take a note:',
  ],
  accentColor: 'violet',
};

export class PageContextEngine {
  private static instance: PageContextEngine;

  private constructor() {}

  public static getInstance(): PageContextEngine {
    if (!PageContextEngine.instance) {
      PageContextEngine.instance = new PageContextEngine();
    }
    return PageContextEngine.instance;
  }

  public getContextForRoute(pathname: string): PageContext {
    // Exact match first
    if (PAGE_CONTEXT_MAP[pathname]) return PAGE_CONTEXT_MAP[pathname];

    // Prefix match (e.g. /desktop/pro/business/crm → /desktop/pro/business)
    const keys = Object.keys(PAGE_CONTEXT_MAP);
    const match = keys.find(k => pathname.startsWith(k) && k !== '/');
    if (match) return PAGE_CONTEXT_MAP[match];

    return DEFAULT_CONTEXT;
  }

  public getAllContexts(): PageContext[] {
    return Object.values(PAGE_CONTEXT_MAP);
  }
}

export const pageContextEngine = PageContextEngine.getInstance();
