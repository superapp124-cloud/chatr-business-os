export type IntentContext = {
  type: 'empty' | 'document' | 'browser' | 'chat' | 'workflow';
  title: string;
  data?: any;
};

export type TimelineEvent = {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  category: 'intent' | 'memory' | 'communication' | 'workflow' | 'browser';
};

class IntentPipelineManager {
  private listeners: ((context: IntentContext) => void)[] = [];
  private timelineListeners: ((events: TimelineEvent[]) => void)[] = [];
  private timeline: TimelineEvent[] = [];
  private currentContext: IntentContext = { type: 'empty', title: 'Ready' };

  constructor() {
    // Initial mock timeline for the "First Experience"
    this.addTimelineEvent({
      id: 'boot',
      timestamp: new Date().toISOString(),
      title: 'Workspace Initialized',
      description: 'System index loaded. Memory ready.',
      category: 'intent'
    });
  }

  // --- Subscriptions ---
  
  onContextChange(callback: (context: IntentContext) => void) {
    this.listeners.push(callback);
    callback(this.currentContext);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  onTimelineChange(callback: (events: TimelineEvent[]) => void) {
    this.timelineListeners.push(callback);
    callback(this.timeline);
    return () => {
      this.timelineListeners = this.timelineListeners.filter(l => l !== callback);
    };
  }

  // --- Internal State Updates ---

  private setContext(context: IntentContext) {
    this.currentContext = context;
    this.listeners.forEach(l => l(this.currentContext));
  }

  private addTimelineEvent(event: TimelineEvent) {
    this.timeline = [event, ...this.timeline];
    this.timelineListeners.forEach(l => l(this.timeline));
  }

  // --- The Core Pipeline (Intent -> Planner -> Capabilities -> Memory) ---

  /**
   * Processes a raw string intent from the user (e.g., from the Command Palette)
   */
  async process(rawIntent: string) {
    const ts = new Date().toISOString();
    
    this.addTimelineEvent({
      id: crypto.randomUUID(),
      timestamp: ts,
      title: `Intent Received: "${rawIntent}"`,
      description: 'Routing to kernel planner...',
      category: 'intent'
    });

    try {
      const electron = (window as any).require ? (window as any).require('electron') : null;
      if (electron && electron.ipcRenderer) {
        // We set up event listeners for streaming execution
        const handlePlanStarted = (_, data: any) => {
          this.addTimelineEvent({
            id: `plan-${data.intentId}`,
            timestamp: new Date().toISOString(),
            title: 'Planning execution...',
            description: `Generated execution graph with ${data.nodeCount} steps.`,
            category: 'intent'
          });
        };

        const handleNodeStarted = (_, data: any) => {
          let desc = `Executing step: ${data.node.action}`;
          if (data.node.action === 'search_document') desc = 'Searching documents...';
          if (data.node.action === 'summarize_document') desc = 'Summarizing...';
          if (data.node.action === 'draft_email') desc = 'Drafting email...';

          this.addTimelineEvent({
            id: `node-${data.node.id}`,
            timestamp: new Date().toISOString(),
            title: desc,
            description: `Runtime: ${data.node.runtime}`,
            category: 'workflow'
          });
        };

        const handleNodeAwaitingApproval = (_, data: any) => {
          this.addTimelineEvent({
            id: `appr-${data.node.id}`,
            timestamp: new Date().toISOString(),
            title: 'Waiting for approval...',
            description: `Action '${data.node.action}' requires user approval.`,
            category: 'intent'
          });
        };

        const handleNodeCompleted = (_, data: any) => {
          const res = data.nodeResult;
          if (res.status === 'failed') {
            this.addTimelineEvent({
              id: `fail-${res.id}`,
              timestamp: new Date().toISOString(),
              title: `Failed: ${res.capability}`,
              description: res.error,
              category: 'intent'
            });
            return;
          }

          let title = `Completed: ${res.capability}`;
          let desc = `Duration: ${res.durationMs}ms (Locality: ${res.locality})`;

          // Specific UI Context Updates for the demo
          if (res.action === 'search_document' && res.output?.found) {
            title = '✓ Document found';
            desc = res.output.files[0].name;
            this.setContext({
              type: 'document',
              title: res.output.files[0].name,
              data: { text: res.output.files[0].contentPreview }
            });
          }
          if (res.action === 'summarize_document') {
             title = '✓ Summary generated';
             desc = res.output.summary;
          }
          if (res.action === 'draft_email') {
             title = '✓ Email Drafted';
             desc = `Launched OS client via ${res.output.uri}`;
          }
          if (res.action === 'create_reminder') {
             title = '✓ Reminder Created';
             desc = `Due: ${res.output.dueDate}`;
          }

          this.addTimelineEvent({
            id: `comp-${res.id}`,
            timestamp: res.finishedAt,
            title,
            description: desc,
            category: 'intent'
          });
        };

        // Attach listeners
        electronAPI.on('execution:plan_started', handlePlanStarted);
        electronAPI.on('execution:node_started', handleNodeStarted);
        electronAPI.on('execution:node_awaiting_approval', handleNodeAwaitingApproval);
        electronAPI.on('execution:node_completed', handleNodeCompleted);

        // Invoke backend process
        const result = await electronAPI.kernel.invoke('intent:process', rawIntent);

        // Detach listeners after complete
        electronAPI.off('execution:plan_started', handlePlanStarted);
        electronAPI.off('execution:node_started', handleNodeStarted);
        electronAPI.off('execution:node_awaiting_approval', handleNodeAwaitingApproval);
        electronAPI.off('execution:node_completed', handleNodeCompleted);

        if (!result.ok) {
          throw new Error(result.error);
        }
      } else {
        // Fallback Mock Execution for standard web browser
        const stepId = crypto.randomUUID();
        this.addTimelineEvent({
          id: `plan-${stepId}`,
          timestamp: new Date().toISOString(),
          title: 'Planning execution...',
          description: `Generated execution graph via Web Fallback.`,
          category: 'intent'
        });
        
        setTimeout(() => {
          this.addTimelineEvent({
            id: `node-${stepId}`,
            timestamp: new Date().toISOString(),
            title: 'Processing Request...',
            description: `Runtime: WebSandbox`,
            category: 'workflow'
          });
        }, 800);

        setTimeout(() => {
          let contextData: any = { text: "Simulated response for: " + rawIntent };
          let contextTitle = rawIntent;
          
          if (rawIntent.toLowerCase().includes('invoice')) {
            contextTitle = "Invoice #INV-2026-089";
            contextData = {
               vendor: "Acme Corp",
               amount: "$1,450.00",
               text: "Services Rendered: Q3 Marketing Campaign Design\nDate: July 12, 2026\nTerms: Net 30\nStatus: UNPAID"
            };
          } else if (rawIntent.toLowerCase().includes('email')) {
            contextTitle = "Draft: Project Update";
            contextData = {
               vendor: "To: Client Team",
               text: "Hi Team,\n\nI wanted to provide a quick update on our progress this week. We have successfully hit our milestone for Phase 1 and are moving into Phase 2.\n\nPlease let me know if you have any questions.\n\nBest,\nArshid"
            };
          } else if (rawIntent.toLowerCase().includes('summarize')) {
            contextTitle = "Q3 Deliverables Summary";
            contextData = {
               text: "• Completed frontend redesign of Workspace IDE\n• Migrated Knowledge Graph to Supabase\n• Resolved IPC fallbacks for web browsers\n\nOverall Status: GREEN. We are on track for the Alpha release next week."
            };
          } else if (rawIntent.toLowerCase().includes('sync')) {
            contextTitle = "Calendar Event Scheduled";
            contextData = {
               vendor: "Attendees: Engineering Team",
               text: "Time: Tomorrow at 10:00 AM PST\nLocation: Zoom Room B\nAgenda: Discuss backend architecture for intent processing."
            };
          }

          this.setContext({
            type: 'document',
            title: contextTitle,
            data: contextData
          });
          this.addTimelineEvent({
            id: `comp-${stepId}`,
            timestamp: new Date().toISOString(),
            title: '✓ Request Completed',
            description: `Duration: 1420ms (Locality: Web)`,
            category: 'intent'
          });
        }, 1500);
      }
    } catch (e: any) {
      this.addTimelineEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        title: 'Pipeline Error',
        description: e.message || 'Unknown error',
        category: 'intent'
      });
    }
  }
}

export const IntentPipeline = new IntentPipelineManager();
