import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MessageSquare, FileText, Calendar, Sparkles, ZoomIn, ZoomOut,
  Search, Users, LayoutGrid, List, GitBranch, Clock, Activity,
  ChevronRight, ChevronDown, Brain, Zap, AlertTriangle, CheckCircle,
  ArrowRight, Star, BarChart2, Play, MoreHorizontal, Share2, Download,
  Eye, Edit2, Send, PlusCircle, Filter, BarChart, MapPin, Layers,
  Briefcase, Hash, Bell, Settings, RefreshCw, Cpu, Globe, X,
  MessageCircle, Phone, Video, UserPlus, FilePlus, FolderOpen, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useKnowledgeGraph, KnowledgeNode, KnowledgeEdge, NodeType, EdgeLabel, JourneyStep, WorkLogItem, TeamMember } from '@/hooks/useKnowledgeGraph';
import { DocumentLockBadge } from '@/platform/Domain/Collaboration/DocumentLockBadge';

type ViewMode = 'graph' | 'timeline' | 'board' | 'list' | 'calendar';

const nodeColors: Record<NodeType, { bg: string; border: string; icon: string; badge: string }> = {
  meeting:   { bg: '#1e1b4b', border: '#6366f1', icon: '#818cf8', badge: '#6366f1' },
  document:  { bg: '#0c1a2e', border: '#0ea5e9', icon: '#38bdf8', badge: '#0ea5e9' },
  person:    { bg: '#0d1f17', border: '#10b981', icon: '#34d399', badge: '#10b981' },
  candidate: { bg: '#1c0d2e', border: '#c084fc', icon: '#e879f9', badge: '#c084fc' },
  customer:  { bg: '#061d24', border: '#06b6d4', icon: '#22d3ee', badge: '#06b6d4' },
  invoice:   { bg: '#26170c', border: '#f97316', icon: '#fb923c', badge: '#f97316' },
  ticket:    { bg: '#1f130b', border: '#d97706', icon: '#f59e0b', badge: '#d97706' },
  workflow:  { bg: '#0c1d1a', border: '#14b8a6', icon: '#2dd4bf', badge: '#14b8a6' },
  agent:     { bg: '#1a0f2e', border: '#a855f7', icon: '#c084fc', badge: '#a855f7' },
  kpi:       { bg: '#172554', border: '#3b82f6', icon: '#60a5fa', badge: '#3b82f6' },
  risk:      { bg: '#2e0f14', border: '#f43f5e', icon: '#fb7185', badge: '#f43f5e' },
  project:   { bg: '#1e1b4b', border: '#8b5cf6', icon: '#a78bfa', badge: '#8b5cf6' },
  task:      { bg: '#1c150a', border: '#eab308', icon: '#fde047', badge: '#eab308' },
  contract:  { bg: '#0f172a', border: '#64748b', icon: '#94a3b8', badge: '#64748b' },
  chat:      { bg: '#0f1c1a', border: '#14b8a6', icon: '#2dd4bf', badge: '#14b8a6' },
  ai:        { bg: '#1a0f2e', border: '#a855f7', icon: '#c084fc', badge: '#a855f7' },
};

const nodeHoverActions: Record<NodeType, { label: string; icon: React.ReactNode }[]> = {
  meeting:   [{ label: 'Join', icon: <Video className="w-3.5 h-3.5" /> }, { label: 'Prepare', icon: <FileText className="w-3.5 h-3.5" /> }],
  document:  [{ label: 'Open', icon: <FolderOpen className="w-3.5 h-3.5" /> }, { label: 'Summarize', icon: <Brain className="w-3.5 h-3.5" /> }],
  person:    [{ label: 'Message', icon: <MessageCircle className="w-3.5 h-3.5" /> }, { label: 'Call', icon: <Phone className="w-3.5 h-3.5" /> }],
  candidate: [{ label: 'View Profile', icon: <Eye className="w-3.5 h-3.5" /> }, { label: 'Schedule Interview', icon: <Calendar className="w-3.5 h-3.5" /> }],
  customer:  [{ label: 'View Deal', icon: <Briefcase className="w-3.5 h-3.5" /> }, { label: 'Contact', icon: <MessageCircle className="w-3.5 h-3.5" /> }],
  invoice:   [{ label: 'Approve', icon: <CheckCircle className="w-3.5 h-3.5" /> }, { label: 'View PDF', icon: <FileText className="w-3.5 h-3.5" /> }],
  ticket:    [{ label: 'Resolve', icon: <CheckCircle className="w-3.5 h-3.5" /> }, { label: 'Assign', icon: <UserPlus className="w-3.5 h-3.5" /> }],
  workflow:  [{ label: 'Run', icon: <Play className="w-3.5 h-3.5" /> }, { label: 'Edit', icon: <Edit2 className="w-3.5 h-3.5" /> }],
  agent:     [{ label: 'Chat', icon: <Sparkles className="w-3.5 h-3.5" /> }, { label: 'Configure', icon: <Settings className="w-3.5 h-3.5" /> }],
  kpi:       [{ label: 'Analytics', icon: <BarChart2 className="w-3.5 h-3.5" /> }],
  risk:      [{ label: 'Mitigate', icon: <Zap className="w-3.5 h-3.5" /> }, { label: 'Assign Owner', icon: <UserPlus className="w-3.5 h-3.5" /> }],
  project:   [{ label: 'Dashboard', icon: <Layers className="w-3.5 h-3.5" /> }, { label: 'Timeline', icon: <Clock className="w-3.5 h-3.5" /> }],
  task:      [{ label: 'Complete', icon: <CheckCircle className="w-3.5 h-3.5" /> }, { label: 'Comment', icon: <MessageCircle className="w-3.5 h-3.5" /> }],
  contract:  [{ label: 'View Legal', icon: <FileText className="w-3.5 h-3.5" /> }],
  chat:      [{ label: 'Open Chat', icon: <MessageCircle className="w-3.5 h-3.5" /> }],
  ai:        [{ label: 'Ask AI', icon: <Sparkles className="w-3.5 h-3.5" /> }],
};

const getNodeIcon = (type: NodeType, size = 'w-5 h-5') => {
  const colors = nodeColors[type] || nodeColors.document;
  switch (type) {
    case 'meeting':   return <Calendar className={size} style={{ color: colors.icon }} />;
    case 'document':  return <FileText className={size} style={{ color: colors.icon }} />;
    case 'person':    return <Users className={size} style={{ color: colors.icon }} />;
    case 'candidate': return <UserPlus className={size} style={{ color: colors.icon }} />;
    case 'customer':  return <Briefcase className={size} style={{ color: colors.icon }} />;
    case 'invoice':   return <BarChart className={size} style={{ color: colors.icon }} />;
    case 'ticket':    return <Hash className={size} style={{ color: colors.icon }} />;
    case 'workflow':  return <GitBranch className={size} style={{ color: colors.icon }} />;
    case 'agent':     return <Cpu className={size} style={{ color: colors.icon }} />;
    case 'kpi':       return <BarChart2 className={size} style={{ color: colors.icon }} />;
    case 'risk':      return <AlertTriangle className={size} style={{ color: colors.icon }} />;
    case 'project':   return <Layers className={size} style={{ color: colors.icon }} />;
    case 'task':      return <CheckCircle className={size} style={{ color: colors.icon }} />;
    case 'contract':  return <FileText className={size} style={{ color: colors.icon }} />;
    case 'chat':      return <MessageSquare className={size} style={{ color: colors.icon }} />;
    case 'ai':        return <Brain className={size} style={{ color: colors.icon }} />;
    default:          return <FileText className={size} style={{ color: colors.icon }} />;
  }
};

const statusBadge = (status?: string) => {
  if (!status || status === 'idle') return null;
  const cfg: Record<string, { label: string; color: string; pulse: boolean }> = {
    live: { label: 'Live', color: '#22c55e', pulse: true },
    recent: { label: 'Updated', color: '#0ea5e9', pulse: false },
    typing: { label: 'Typing…', color: '#6366f1', pulse: true },
    summarizing: { label: 'AI Working…', color: '#a855f7', pulse: true },
    warning: { label: 'Alert', color: '#f43f5e', pulse: true },
  };
  const c = cfg[status];
  if (!c) return null;
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: c.color + '22', color: c.color }}>
      {c.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: c.color }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: c.color }} />
        </span>
      )}
      {c.label}
    </span>
  );
};

interface NodeCardProps {
  node: KnowledgeNode;
  isSelected: boolean;
  onClick: () => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const colors = nodeColors[node.type] || nodeColors.document;
  const actions = nodeHoverActions[node.type] || [];

  return (
    <div
      className="canvas-node absolute select-none"
      style={{ left: node.x, top: node.y, width: 220, zIndex: hovered || isSelected ? 10 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        className="rounded-2xl p-3.5 cursor-pointer transition-all duration-200"
        style={{
          background: colors.bg,
          border: `1.5px solid ${isSelected ? colors.border : hovered ? colors.border + '88' : colors.border + '33'}`,
          boxShadow: isSelected
            ? `0 0 0 3px ${colors.border}33, 0 8px 32px ${colors.border}22`
            : hovered ? `0 6px 24px ${colors.border}22` : '0 2px 8px #00000030',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl" style={{ background: colors.border + '22' }}>
              {getNodeIcon(node.type)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight truncate max-w-[120px]">
                {node.title}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusBadge(node.status)}
            {node.health !== undefined && (
              <span className="text-[10px] text-slate-400 font-mono">{node.health}% health</span>
            )}
          </div>
        </div>
        {node.subtitle && (
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2 line-clamp-2">{node.subtitle}</p>
        )}
        {node.people && node.people.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {node.people.slice(0, 3).map((p, i) => (
              <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: colors.border + '22', color: colors.icon }}>
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {hovered && (
        <div className="flex items-center gap-1 mt-1.5 px-2 py-1.5 rounded-xl" style={{ background: '#1a1d2e', border: '1px solid #ffffff10' }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                toast.success(`Action "${a.label}" triggered for ${node.title}`);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
              style={{ color: colors.icon }}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CanvasEdges: React.FC<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> = ({ nodes, edges }) => {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: 3000, height: 3000, zIndex: 0 }}>
      <defs>
        {edges.map((e, i) => (
          <marker key={i} id={`arrow-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={e.color + '88'} />
          </marker>
        ))}
      </defs>
      {edges.map((edge, i) => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const x1 = from.x + 110;
        const y1 = from.y + 44;
        const x2 = to.x + 110;
        const y2 = to.y + 44;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const cpx = mx - (dy / len) * 40;
        const cpy = my + (dx / len) * 40;
        return (
          <g key={i}>
            <path
              d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
              fill="none"
              stroke={edge.color + '44'}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              markerEnd={`url(#arrow-${i})`}
            />
            <text
              x={cpx} y={cpy - 6}
              textAnchor="middle"
              fontSize="9"
              fill={edge.color + 'aa'}
              style={{ fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {edge.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const InfiniteCanvas: React.FC = () => {
  const { nodes, edges, updateNodePosition, teamMembers, journeySteps, workLog } = useKnowledgeGraph();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const location = useLocation();

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [showAIAnswer, setShowAIAnswer] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<{ summary: string; items: { type: string; title: string }[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'worklog' | 'analytics' | 'journey'>('worklog');

  const handleAISearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setAiLoading(true);
    setShowAIAnswer(true);
    setAiAnswer(null);
    try {
      const { generate } = await import('@/services/ai');
      const answer = await generate({
        prompt: `You are the AI assistant for CHATR Business Canvas. Query: "${query}". Provide a concise 2-sentence workspace response.`
      });

      setAiAnswer({
        summary: answer,
        items: nodes
          .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
          .map(n => ({ type: n.type, title: n.title }))
      });
    } catch {
      setAiAnswer({
        summary: `Found matches for "${query}" in workspace graph.`,
        items: nodes
          .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
          .map(n => ({ type: n.type, title: n.title }))
      });
    } finally {
      setAiLoading(false);
    }
  }, [nodes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (viewMode !== 'graph') return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setScale(s => Math.min(Math.max(0.2, s + delta)));
    } else {
      setPosition(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [viewMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== 'graph') return;
    if ((e.target as HTMLElement).closest('.canvas-node')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const filteredNodes = useMemo(() => nodes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [nodes, searchQuery]);

  const renderNavItems = useMemo(() => {
    const counts = nodes.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { id: 'projects', icon: <Briefcase className="w-4 h-4" />, label: 'Projects', count: (counts['project'] || 0) + 11 },
      { id: 'people', icon: <Users className="w-4 h-4" />, label: 'People', count: (counts['person'] || 0) + 57 },
      { id: 'meetings', icon: <Calendar className="w-4 h-4" />, label: 'Meetings', count: (counts['meeting'] || 0) + 18 },
      { id: 'docs', icon: <FileText className="w-4 h-4" />, label: 'Documents', count: (counts['document'] || 0) + 301 },
      { id: 'candidates', icon: <UserPlus className="w-4 h-4" />, label: 'Candidates', count: (counts['candidate'] || 0) + 41 },
      { id: 'customers', icon: <Briefcase className="w-4 h-4" />, label: 'Customers', count: (counts['customer'] || 0) + 83 },
      { id: 'risks', icon: <AlertTriangle className="w-4 h-4" />, label: 'Risks', count: (counts['risk'] || 0) + 6 },
      { id: 'agents', icon: <Cpu className="w-4 h-4" />, label: 'Agents', count: (counts['agent'] || 0) + 4 },
    ].map(item => (
      <button key={item.id} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors group cursor-pointer">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">{item.icon}</span>
          {!leftCollapsed && <span className="text-xs font-semibold">{item.label}</span>}
        </div>
        {!leftCollapsed && <span className="text-[10px] font-bold bg-white/5 text-indigo-300 px-2 py-0.5 rounded-full">{item.count}</span>}
      </button>
    ));
  }, [nodes, leftCollapsed]);

  const viewModes: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'graph', icon: <GitBranch className="w-4 h-4" />, label: 'Graph' },
    { id: 'timeline', icon: <Clock className="w-4 h-4" />, label: 'Timeline' },
    { id: 'board', icon: <LayoutGrid className="w-4 h-4" />, label: 'Board' },
    { id: 'list', icon: <List className="w-4 h-4" />, label: 'List' },
    { id: 'calendar', icon: <Calendar className="w-4 h-4" />, label: 'Calendar' },
  ];

  return (
    <div className="flex flex-col w-full h-full overflow-hidden text-white" style={{ background: '#080a10', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: '#0d0f1a', borderBottom: '1px solid #ffffff0d' }}>
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
            <Globe className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black text-sm tracking-tight">Business Canvas</span>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Business OS</span>
        </div>

        <div className="flex-1 relative max-w-xl flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search candidates, projects, docs, meetings…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs text-white outline-none transition-all"
            style={{ background: '#ffffff0d', border: '1px solid #ffffff10' }}
          />
        </div>

        <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: '#ffffff0d' }}>
          {viewModes.map(vm => (
            <button
              key={vm.id}
              onClick={() => setViewMode(vm.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: viewMode === vm.id ? '#6366f1' : 'transparent',
                color: viewMode === vm.id ? '#fff' : '#64748b',
              }}
            >
              {vm.icon}
              <span className="hidden lg:inline">{vm.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT NAVIGATOR ── */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300"
          style={{ width: leftCollapsed ? 48 : 200, background: '#0d0f1a', borderRight: '1px solid #ffffff0d' }}
        >
          <button
            onClick={() => setLeftCollapsed(c => !c)}
            className="flex items-center justify-center p-3 text-slate-500 hover:text-white transition-colors self-end cursor-pointer"
          >
            {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className="flex flex-col gap-0.5 px-2 flex-1">
            {renderNavItems}
          </div>
        </div>

        {/* ── CENTER: GRAPH / CANVAS ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">

          {viewMode === 'graph' && (
            <div
              ref={containerRef}
              className={`flex-1 relative overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{
                backgroundImage: 'radial-gradient(circle, #ffffff08 1px, transparent 1px)',
                backgroundSize: `${32 * scale}px ${32 * scale}px`,
                backgroundPosition: `${position.x}px ${position.y}px`,
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                className="absolute origin-top-left"
                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, willChange: 'transform' }}
              >
                <CanvasEdges nodes={filteredNodes} edges={edges} />
                {filteredNodes.map(node => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    isSelected={selectedNode?.id === node.id}
                    onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  />
                ))}
              </div>

              {/* Zoom Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-2xl z-50"
                style={{ background: '#0d0f1a', border: '1px solid #ffffff10', boxShadow: '0 8px 32px #00000040' }}>
                <button onClick={() => setScale(s => Math.max(0.2, s - 0.2))} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-300 w-10 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button onClick={() => { setPosition({ x: 0, y: 0 }); setScale(1); }} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Bottom Work Log / Analytics Bar ── */}
          <div className="flex-shrink-0" style={{ background: '#0d0f1a', borderTop: '1px solid #ffffff0d', height: 135 }}>
            <div className="flex items-center gap-1 px-4 py-1.5 border-b border-white/5">
              {[
                { id: 'worklog' as const, label: 'Work Log', icon: <Activity className="w-3.5 h-3.5" /> },
                { id: 'analytics' as const, label: 'Analytics', icon: <BarChart2 className="w-3.5 h-3.5" /> },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveBottomTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background: activeBottomTab === tab.id ? '#ffffff10' : 'transparent',
                    color: activeBottomTab === tab.id ? '#e2e8f0' : '#64748b',
                  }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-4 px-4 py-2.5 overflow-x-auto">
              {activeBottomTab === 'worklog' && workLog.map((item, i) => (
                <div key={i} className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl"
                  style={{ background: '#ffffff06', border: '1px solid #ffffff08' }}>
                  <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                  <div className="p-1 rounded-lg" style={{ background: (nodeColors[item.type] || nodeColors.document).border + '22' }}>
                    {getNodeIcon(item.type, 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold whitespace-nowrap">{item.actor} {item.action}</p>
                    <p className="text-slate-400 text-[10px] whitespace-nowrap">{item.target}</p>
                  </div>
                </div>
              ))}

              {activeBottomTab === 'analytics' && (
                <div className="flex gap-4 flex-shrink-0">
                  {[
                    { label: 'Total Items', val: nodes.length.toString(), icon: <Layers className="w-4 h-4" />, color: '#6366f1' },
                    { label: 'Active People', val: teamMembers.length.toString(), icon: <Users className="w-4 h-4" />, color: '#10b981' },
                    { label: 'Open Tasks', val: '6', icon: <CheckCircle className="w-4 h-4" />, color: '#f59e0b' },
                    { label: 'Documents', val: '302', icon: <FileText className="w-4 h-4" />, color: '#0ea5e9' },
                  ].map((m, i) => (
                    <div key={i} className="flex-shrink-0 flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: '#ffffff06', border: '1px solid #ffffff08' }}>
                      <div className="p-1.5 rounded-lg" style={{ background: m.color + '22', color: m.color }}>
                        {m.icon}
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{m.val}</p>
                        <p className="text-slate-400 text-[10px]">{m.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Single Clean AI Assistant ── */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 300, background: '#0d0f1a', borderLeft: '1px solid #ffffff0d' }}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* AI Header */}
            <div className="px-4 pt-3.5 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-white font-bold text-xs">AI Assistant</span>
                <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live
                </span>
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && aiQuery) handleAISearch(aiQuery); }}
                  placeholder="Ask about candidates, projects…"
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs text-white outline-none bg-white/5 border border-white/10"
                />
                <button
                  onClick={() => handleAISearch(aiQuery)}
                  disabled={aiLoading}
                  className="p-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 cursor-pointer disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Highlights Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {showAIAnswer && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300 text-xs font-bold">AI Response</span>
                    <button onClick={() => { setShowAIAnswer(false); setAiQuery(''); setAiAnswer(null); }} className="ml-auto text-slate-400 hover:text-white cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">{aiAnswer?.summary}</p>
                </div>
              )}

              <div>
                <p className="text-slate-400 text-xs font-bold mb-2">Key Highlights</p>
                <div className="space-y-2">
                  {[
                    { text: 'Project Apollo has 3 active engineering blockers', color: '#f59e0b', icon: <Zap /> },
                    { text: 'Rajesh Kumar connected to 2 active requisitions', color: '#c084fc', icon: <UserPlus /> },
                    { text: 'Invoice INV-304 affects Project Apollo budget', color: '#fb923c', icon: <BarChart /> },
                    { text: 'Master Service Agreement pending legal approval', color: '#38bdf8', icon: <FileText /> },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 cursor-pointer transition-all">
                      <div className="p-1 rounded-lg flex-shrink-0 mt-0.5" style={{ background: item.color + '22', color: item.color }}>
                        {React.cloneElement(item.icon, { className: 'w-3.5 h-3.5' })}
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Online */}
              <div>
                <p className="text-slate-400 text-xs font-bold mb-2">Team Online</p>
                <div className="space-y-1.5">
                  {teamMembers.map((m, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                      <div className="relative flex-shrink-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: m.color }}>
                          {m.initials}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d0f1a]"
                          style={{ background: m.status === 'online' ? '#22c55e' : m.status === 'busy' ? '#f59e0b' : '#64748b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium">{m.name}</p>
                        <p className="text-slate-400 text-[10px] truncate">{m.activity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Workflows Footer */}
            <div className="p-3 mx-3 mb-3 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-white text-xs font-bold">Active Workflows</span>
              </div>
              <p className="text-slate-400 text-[11px] mb-2 leading-tight">Automated candidate screening & contract triggers running.</p>
              <button className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer">
                Manage Workflows <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
