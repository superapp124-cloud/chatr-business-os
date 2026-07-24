import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type NodeType = 
  | 'meeting' 
  | 'document' 
  | 'person' 
  | 'candidate' 
  | 'customer' 
  | 'invoice' 
  | 'ticket' 
  | 'workflow' 
  | 'agent' 
  | 'kpi' 
  | 'risk' 
  | 'project' 
  | 'task' 
  | 'contract' 
  | 'chat' 
  | 'ai';

export type EdgeLabel = 
  | 'reviewed' 
  | 'discussed' 
  | 'approved' 
  | 'referenced' 
  | 'assigned' 
  | 'created' 
  | 'depends_on' 
  | 'interviewed' 
  | 'billed' 
  | 'mitigates' 
  | 'triggers';

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  subtitle?: string;
  status?: 'live' | 'recent' | 'typing' | 'summarizing' | 'idle' | 'warning' | 'done';
  meta?: Record<string, string>;
  people?: string[];
  health?: number;
  raw_content?: string;
  isHighlighted?: boolean;
  domain?: 'Recruitment' | 'CRM' | 'Finance' | 'Engineering' | 'Legal' | 'Operations';
}

export interface KnowledgeEdge {
  id: string;
  from: string;
  to: string;
  label: EdgeLabel;
  color: string;
  isHighlighted?: boolean;
}

export interface JourneyStep {
  iconType?: string;
  label: string;
  time: string;
  actor?: string;
  detail?: string;
}

export interface WorkLogItem {
  time: string;
  actor: string;
  action: string;
  target: string;
  type: NodeType;
}

export interface TeamMember {
  id?: string;
  name: string;
  initials: string;
  color: string;
  status: 'online' | 'idle' | 'busy';
  activity: string;
}

export interface SuggestedEdge {
  id: string;
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
  reason: string;
  confidence: number;
}

const DEFAULT_UNIVERSAL_NODES: KnowledgeNode[] = [
  // Center Anchor: Project Apollo
  { id: 'proj-apollo', type: 'project', title: 'Project Apollo (V2 Launch)', subtitle: 'Core Business OS Infrastructure', x: 420, y: 260, health: 88, status: 'live', domain: 'Engineering', people: ['Arshid Wani', 'Sarah Jenkins'] },
  
  // Connected Candidates (Recruitment)
  { id: 'cand-rajesh', type: 'candidate', title: 'Rajesh Kumar (Senior React)', subtitle: 'Interviewing · Offer Stage (₹32L)', x: 140, y: 120, health: 92, status: 'recent', domain: 'Recruitment', people: ['HR Team'] },
  
  // Connected CRM Customer
  { id: 'cust-acme', type: 'customer', title: 'Acme Corp ($120k ARR)', subtitle: 'Enterprise Renewal & Scale', x: 700, y: 140, health: 95, status: 'live', domain: 'CRM', people: ['Sales Director'] },

  // Connected Contract
  { id: 'doc-contract', type: 'contract', title: 'Acme Master Service Agreement.pdf', subtitle: 'Legal Review · Pending Signatures', x: 740, y: 340, health: 70, status: 'warning', domain: 'Legal', people: ['Legal Desk'] },

  // Connected Finance Invoice
  { id: 'inv-q3-payroll', type: 'invoice', title: 'July Payroll & Vendors (₹48.2L)', subtitle: 'Finance Approval Pending', x: 420, y: 520, health: 65, status: 'warning', domain: 'Finance', people: ['Finance Team'] },

  // Connected Risk
  { id: 'risk-latency', type: 'risk', title: 'Voice AI Latency Spike (>350ms)', subtitle: 'High Severity Risk Alert', x: 180, y: 380, health: 45, status: 'warning', domain: 'Engineering', people: ['DevOps'] },

  // Connected Workflow
  { id: 'wf-auto-screen', type: 'workflow', title: 'AI Candidate Screening Workflow', subtitle: 'Automation Studio (Active)', x: 120, y: 240, health: 98, status: 'live', domain: 'Operations', people: ['AI Agent'] },

  // Connected Meeting
  { id: 'meet-sync', type: 'meeting', title: 'Weekly Executive Alignment', subtitle: 'Today 3:00 PM (Calls Room)', x: 420, y: 60, health: 90, status: 'idle', domain: 'Operations', people: ['Arshid', 'Sarah', 'Michael'] },

  // Connected AI Agent
  { id: 'agent-chief', type: 'agent', title: 'Chief of Staff AI', subtitle: 'Intent Processing Engine', x: 620, y: 460, health: 99, status: 'summarizing', domain: 'Operations', people: ['chatrAI'] },
];

const DEFAULT_UNIVERSAL_EDGES: KnowledgeEdge[] = [
  { id: 'e1', from: 'cand-rajesh', to: 'proj-apollo', label: 'assigned', color: '#10b981' },
  { id: 'e2', from: 'wf-auto-screen', to: 'cand-rajesh', label: 'interviewed', color: '#a855f7' },
  { id: 'e3', from: 'proj-apollo', to: 'cust-acme', label: 'referenced', color: '#0ea5e9' },
  { id: 'e4', from: 'cust-acme', to: 'doc-contract', label: 'approved', color: '#f59e0b' },
  { id: 'e5', from: 'proj-apollo', to: 'inv-q3-payroll', label: 'billed', color: '#ef4444' },
  { id: 'e6', from: 'proj-apollo', to: 'risk-latency', label: 'depends_on', color: '#ef4444' },
  { id: 'e7', from: 'meet-sync', to: 'proj-apollo', label: 'discussed', color: '#6366f1' },
  { id: 'e8', from: 'agent-chief', to: 'proj-apollo', label: 'triggers', color: '#c084fc' },
];

export function useKnowledgeGraph() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>(DEFAULT_UNIVERSAL_NODES);
  const [edges, setEdges] = useState<KnowledgeEdge[]>(DEFAULT_UNIVERSAL_EDGES);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([]);
  const [workLog, setWorkLog] = useState<WorkLogItem[]>([]);
  const [suggestedEdges, setSuggestedEdges] = useState<SuggestedEdge[]>([
    { id: 's1', fromId: 'doc-contract', fromTitle: 'Acme MSA.pdf', toId: 'inv-q3-payroll', toTitle: 'July Payroll & Vendors', reason: 'Contract references payment terms of ₹48.2L invoice', confidence: 94 },
    { id: 's2', fromId: 'cand-rajesh', fromTitle: 'Rajesh Kumar', toId: 'risk-latency', toTitle: 'Voice AI Latency Spike', reason: 'Candidate has 5+ yrs expertise in WebRTC latency optimization', confidence: 89 },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGraph = async () => {
    try {
      // Aggregate from Supabase tables
      const { data: nodesData } = await supabase.from('knowledge_nodes').select('*');
      const { data: edgesData } = await supabase.from('knowledge_edges').select('*');

      if (nodesData && nodesData.length > 0) {
        const fetchedNodes: KnowledgeNode[] = nodesData.map(row => ({
          id: row.id,
          type: (row.entity_type as NodeType) || 'document',
          title: row.title,
          subtitle: row.summary,
          raw_content: row.raw_content,
          x: row.metadata?.position?.x || Math.floor(Math.random() * 500) + 100,
          y: row.metadata?.position?.y || Math.floor(Math.random() * 400) + 100,
          status: row.metadata?.status || 'idle',
          meta: row.metadata?.meta,
          people: row.metadata?.people,
          health: row.metadata?.health || 85,
          domain: row.metadata?.domain || 'Operations',
        }));

        setNodes(prev => {
          const ids = new Set(fetchedNodes.map(n => n.id));
          const uniqueDefault = DEFAULT_UNIVERSAL_NODES.filter(n => !ids.has(n.id));
          return [...fetchedNodes, ...uniqueDefault];
        });
      }

      if (edgesData && edgesData.length > 0) {
        const fetchedEdges: KnowledgeEdge[] = edgesData.map(row => ({
          id: row.id,
          from: row.from_node_id,
          to: row.to_node_id,
          label: (row.relationship_type as EdgeLabel) || 'referenced',
          color: row.metadata?.color || '#6366f1',
        }));
        setEdges(prev => [...fetchedEdges, ...DEFAULT_UNIVERSAL_EDGES]);
      }

      // Profiles for team members
      const { data: profilesData } = await supabase.from('profiles').select('*').limit(10);
      if (profilesData && profilesData.length > 0) {
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#a855f7'];
        setTeamMembers(profilesData.map((p, i) => ({
          id: p.id,
          name: p.full_name || p.username || 'Team Member',
          initials: (p.full_name || p.username || 'TM').substring(0, 2).toUpperCase(),
          color: colors[i % colors.length],
          status: i % 2 === 0 ? 'online' : 'busy',
          activity: p.status || 'Active in Business OS'
        })));
      } else {
        setTeamMembers([
          { id: '1', name: 'Arshid Wani', initials: 'AW', color: '#8b5cf6', status: 'online', activity: 'Managing Project Apollo' },
          { id: '2', name: 'Sarah Jenkins', initials: 'SJ', color: '#10b981', status: 'online', activity: 'Reviewing Acme MSA' },
          { id: '3', name: 'Michael Chen', initials: 'MC', color: '#f59e0b', status: 'busy', activity: 'Debugging Voice AI Spike' },
        ]);
      }

      // Worklog & Journey Steps
      setWorkLog([
        { time: '10:45 AM', actor: 'AI Agent', action: 'flagged risk', target: 'Voice AI Latency Spike (>350ms)', type: 'risk' },
        { time: '10:15 AM', actor: 'Arshid Wani', action: 'moved stage', target: 'Rajesh Kumar → Offer Stage', type: 'candidate' },
        { time: '09:30 AM', actor: 'Sarah Jenkins', action: 'updated', target: 'Acme Master Service Agreement.pdf', type: 'contract' },
        { time: '09:00 AM', actor: 'Finance System', action: 'generated invoice', target: 'July Payroll & Vendors (₹48.2L)', type: 'invoice' },
      ]);

      setJourneySteps([
        { label: 'Project Apollo Created', time: '2 weeks ago', actor: 'Arshid Wani', detail: 'Initialized core Business OS architecture' },
        { label: 'Candidate Interview Completed', time: '3 days ago', actor: 'Recruitment AI', detail: 'Rajesh Kumar scored 94% technical match' },
        { label: 'Acme Corp Deal Signed', time: 'Yesterday', actor: 'Sales Director', detail: 'Enterprise contract sent for final legal review' },
        { label: 'Risk Alert Detected', time: '10 min ago', actor: 'System Telemetry', detail: 'Latency spike triggered engineering priority alert' },
      ]);

    } catch (err: any) {
      console.error('Error fetching knowledge graph:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const updateNodePosition = async (id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
    try {
      await supabase
        .from('knowledge_nodes')
        .update({ metadata: { position: { x, y } } })
        .eq('id', id);
    } catch (e) {
      console.warn('Failed position update', e);
    }
  };

  const acceptSuggestedEdge = (suggested: SuggestedEdge) => {
    const newEdge: KnowledgeEdge = {
      id: `edge-${Date.now()}`,
      from: suggested.fromId,
      to: suggested.toId,
      label: 'referenced',
      color: '#a855f7'
    };
    setEdges(prev => [...prev, newEdge]);
    setSuggestedEdges(prev => prev.filter(s => s.id !== suggested.id));
    toast.success(`Relationship created between "${suggested.fromTitle}" and "${suggested.toTitle}"`);
  };

  const dismissSuggestedEdge = (id: string) => {
    setSuggestedEdges(prev => prev.filter(s => s.id !== id));
  };

  return {
    nodes,
    edges,
    teamMembers,
    journeySteps,
    workLog,
    suggestedEdges,
    isLoading,
    refetch: fetchGraph,
    updateNodePosition,
    acceptSuggestedEdge,
    dismissSuggestedEdge,
    setNodes,
    setEdges,
  };
}
