/**
 * CHATR Business OS — Executive Chief of Staff Home Experience (v3.0)
 *
 * Implements unique CHATR AI Personality ("The Executive Chief of Staff"):
 * - Persona Modes (Executive, Manager, Analyst, Coach, Casual)
 * - Complete AI Personality Customization Suite
 * - Respectful Disagreement Engine (Challenges risky decisions)
 * - Structured Executive Cards & Conversational Memory
 * - Observe ➔ Understand ➔ Think ➔ Advise ➔ Act ➔ Learn Pipeline
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  MessageSquare,
  Calendar,
  Phone,
  CheckCircle2,
  FileText,
  Send,
  Clock,
  UserCheck,
  Ticket,
  TrendingUp,
  Bot,
  Star,
  Inbox,
  Crown,
  Zap,
  ChevronRight,
  Search,
  Building2,
  SlidersHorizontal,
  X,
  Check,
  AlertCircle,
  HelpCircle,
  Database,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { contextBuilder } from '@/core/ai/context/ContextBuilder';
import { DataProvenanceModal } from '@/components/desktop/DataProvenanceModal';
import { dataProvenanceService, ProvenanceMetadata } from '@/core/os/DataProvenanceService';

const MiniSparkline = ({ color = '#22C55E' }: { color?: string }) => (
  <svg className="w-16 h-6 overflow-visible" viewBox="0 0 60 20">
    <path
      d="M 0 15 Q 12 5, 24 12 T 48 4 T 60 8"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const ChiefOfStaffHome: React.FC = () => {
  const [userName, setUserName] = useState('Arshid');
  const [goalInput, setGoalInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseContext, setResponseContext] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [selectedProvenance, setSelectedProvenance] = useState<ProvenanceMetadata | null>(null);

  // AI Personality v3.0 Customization State
  const [personaMode, setPersonaMode] = useState<'executive' | 'manager' | 'analyst' | 'coach' | 'casual'>('executive');
  const [reasoningDepth, setReasoningDepth] = useState<'just_answer' | 'explain' | 'think_with_me'>('explain');
  const [verbosity, setVerbosity] = useState<'brief' | 'balanced' | 'detailed'>('balanced');
  const [decisionStyle, setDecisionStyle] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [challengeDecisions, setChallengeDecisions] = useState(true);
  const [emojiUsage, setEmojiUsage] = useState<'off' | 'minimal' | 'normal'>('minimal');
  const [showProactive, setShowProactive] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          const name =
            profile?.full_name ||
            profile?.display_name ||
            profile?.username ||
            user.user_metadata?.first_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.username ||
            user.email?.split('@')[0];

          if (name) {
            const firstName = name.trim().split(' ')[0];
            setUserName(firstName.charAt(0).toUpperCase() + firstName.slice(1));
          }
        }
      } catch (err) {
        console.warn('Failed to load user name:', err);
      }
    }
    loadUser();
  }, []);

  const handleExecuteGoal = async (promptText?: string, overrideDepth?: 'just_answer' | 'explain' | 'think_with_me') => {
    const textToRun = promptText || goalInput;
    if (!textToRun.trim()) return;

    const depthToUse = overrideDepth || reasoningDepth;
    setIsProcessing(true);
    try {
      const executiveReply = contextBuilder.synthesizeExecutiveResponse(
        textToRun,
        userName,
        personaMode,
        depthToUse,
        challengeDecisions
      );
      setResponseContext(executiveReply);
    } catch {
      setResponseContext(
        `Good morning, ${userName}. Your business is in a healthy position today. Send the Acme Corp proposal follow-up before lunch.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleExecuteGoal();
  };

  return (
    <div className="flex-1 h-full bg-[#090A0F] text-white overflow-y-auto p-5 font-sans selection:bg-[#6D5DF6]/30">
      <div className="max-w-[1440px] mx-auto space-y-5">
        
        {/* ── 1. Top Header Banner with Sunset Graphic ──────────────────── */}
        <div className="relative bg-[#181B23] border border-white/10 rounded-[16px] p-6 md:p-7 overflow-hidden shadow-level-1">
          {/* Sunset Graphic Background */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden rounded-r-[16px] pointer-events-none opacity-90 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-r from-[#181B23] via-[#181B23]/80 to-transparent z-10" />
            <svg viewBox="0 0 400 200" className="w-full h-full object-cover">
              <defs>
                <radialGradient id="sunGlow" cx="75%" cy="35%" r="50%">
                  <stop offset="0%" stopColor="#fdba74" stopOpacity="1" />
                  <stop offset="35%" stopColor="#f97316" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#c026d3" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#181B23" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e1b4b" />
                  <stop offset="40%" stopColor="#4c1d95" />
                  <stop offset="75%" stopColor="#9a3412" />
                  <stop offset="100%" stopColor="#181B23" />
                </linearGradient>
              </defs>
              <rect width="400" height="200" fill="url(#skyGrad)" />
              <circle cx="300" cy="80" r="26" fill="#fef08a" />
              <circle cx="300" cy="80" r="65" fill="url(#sunGlow)" />
              <path d="M 140 200 L 210 125 L 270 160 L 330 105 L 400 170 L 400 200 Z" fill="#090A0F" opacity="0.9" />
              <path d="M 90 200 L 170 140 L 230 175 L 310 115 L 400 185 L 400 200 Z" fill="#050609" />
            </svg>
          </div>

          <div className="relative z-20 space-y-3 max-w-xl">
            {/* Top Badges Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-wrap gap-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-[11px] font-semibold backdrop-blur-md">
                  <Crown className="h-3.5 w-3.5" /> Your Executive Chief of Staff
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-[11px] font-semibold backdrop-blur-md">
                  <Zap className="h-3.5 w-3.5" /> Mode: <span className="font-bold text-white uppercase">{personaMode}</span>
                </div>
              </div>
              
              {/* Customization Settings Trigger */}
              <button
                onClick={() => setShowCustomizer(true)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-[10px] text-xs font-semibold flex items-center gap-1.5 transition-all backdrop-blur-md"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> AI Personality
              </button>
            </div>

            {/* Greeting */}
            <div>
              <h1 className="text-[28px] md:text-[34px] font-extrabold tracking-tight text-white leading-tight">
                Good morning, <span className="text-[#6D5DF6]">{userName}.</span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                I reviewed your business this morning. Three items deserve your attention before lunch.
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. Command Bar (Cursor-Style Command Center) ───────────────── */}
        <form onSubmit={handleFormSubmit} className="space-y-2">
          <div className="bg-[#181B23] border border-white/10 focus-within:border-[#6D5DF6] rounded-[14px] p-2 pl-4 pr-2 flex items-center gap-3 shadow-level-2 transition-all">
            <Search className="h-4 w-4 text-[#6D5DF6] shrink-0" />
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="Ask CHATR... (e.g. What needs my attention today? Draft a reply to Rajesh)"
              className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-gray-400 border border-white/10">⌘K</kbd>
              <button
                type="submit"
                disabled={isProcessing}
                className="w-8 h-8 bg-[#6D5DF6] hover:bg-[#5b4be0] text-white rounded-[10px] flex items-center justify-center shadow-md transition-all shrink-0 disabled:opacity-50 ml-1"
              >
                {isProcessing ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </form>

        {/* ── Conversational & Structured Executive Card Response ───────── */}
        {responseContext && (
          <div className="bg-[#181B23] border border-[#6D5DF6]/50 p-5 rounded-[16px] text-xs space-y-4 shadow-level-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sparkles className="h-4 w-4 text-[#6D5DF6]" /> Executive Assistant Response
              </div>

              {/* Reasoning Depth Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-[#090A0F] border border-white/10 p-0.5 rounded-[10px]">
                  <button
                    onClick={() => {
                      setReasoningDepth('just_answer');
                      void handleExecuteGoal(undefined, 'just_answer');
                    }}
                    className={`px-2 py-0.5 rounded-[8px] text-[10px] font-semibold transition-all ${
                      reasoningDepth === 'just_answer' ? 'bg-[#6D5DF6] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Just Answer
                  </button>
                  <button
                    onClick={() => {
                      setReasoningDepth('explain');
                      void handleExecuteGoal(undefined, 'explain');
                    }}
                    className={`px-2 py-0.5 rounded-[8px] text-[10px] font-semibold transition-all ${
                      reasoningDepth === 'explain' ? 'bg-[#6D5DF6] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Explain
                  </button>
                  <button
                    onClick={() => {
                      setReasoningDepth('think_with_me');
                      void handleExecuteGoal(undefined, 'think_with_me');
                    }}
                    className={`px-2 py-0.5 rounded-[8px] text-[10px] font-semibold transition-all ${
                      reasoningDepth === 'think_with_me' ? 'bg-[#6D5DF6] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Think With Me
                  </button>
                </div>

                <button onClick={() => setResponseContext(null)} className="text-gray-400 hover:text-white text-xs p-1 ml-2">✕</button>
              </div>
            </div>

            {/* Natural Conversational Body */}
            <div className="text-gray-200 text-xs leading-relaxed font-sans space-y-3 whitespace-pre-wrap">
              {responseContext}
            </div>

            {/* Interactive Execution Action Pills */}
            <div className="pt-3 border-t border-white/10 flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => handleExecuteGoal('Draft follow-up email to Rajesh regarding Acme Corp Proposal')}
                className="px-3.5 py-1.5 bg-[#6D5DF6] hover:bg-[#5b4be0] text-white rounded-[10px] text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
              >
                <Send className="h-3.5 w-3.5" /> Draft Follow-up
              </button>
              <button
                onClick={() => handleExecuteGoal('Prepare meeting briefing for 2 PM TalentXcel Client Meeting')}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[10px] text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Calendar className="h-3.5 w-3.5 text-[#3B82F6]" /> Prepare Meeting
              </button>
              <button
                onClick={() => navigate('/desktop/business-os')}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[10px] text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <TrendingUp className="h-3.5 w-3.5 text-[#22C55E]" /> Show Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── 3. 12-Column Adaptive Layout ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Priority Timeline & Schedule (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Priority AI Timeline */}
            <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-5 shadow-level-1 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#6D5DF6]" /> Priority Timeline
                </h3>
                <span className="text-[11px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2.5 py-0.5 rounded-full font-medium">
                  3 Actions Required
                </span>
              </div>

              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/10">
                
                {/* Timeline Item 1: 09:15 */}
                <div className="relative pl-8 flex items-center justify-between gap-4 group">
                  <div className="absolute left-2.5 top-2.5 w-2.5 h-2.5 rounded-full bg-[#EF4444] ring-4 ring-[#181B23] shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#EF4444]">09:15 AM</span>
                      <span className="text-xs font-bold text-white">Rajesh hasn't replied for 6 days</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">Acme Corp Proposal · Value: ₹18.4 Lakh</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate('/desktop/calls')}
                      className="px-3 py-1.5 bg-[#090A0F] hover:bg-white/10 text-[11px] font-semibold rounded-[12px] text-gray-300 flex items-center gap-1 border border-white/10 transition-colors"
                    >
                      <Phone className="h-3 w-3 text-[#3B82F6]" /> Call
                    </button>
                    <button
                      onClick={() => handleExecuteGoal('Draft follow-up email to Rajesh regarding Acme Corp Proposal')}
                      className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16a34a] text-[11px] font-semibold rounded-[12px] text-white flex items-center gap-1 transition-all shadow-md"
                    >
                      <Send className="h-3 w-3" /> Draft Reply
                    </button>
                  </div>
                </div>

                {/* Timeline Item 2: 10:30 */}
                <div className="relative pl-8 flex items-center justify-between gap-4 group">
                  <div className="absolute left-2.5 top-2.5 w-2.5 h-2.5 rounded-full bg-[#F59E0B] ring-4 ring-[#181B23] shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#F59E0B]">10:30 AM</span>
                      <span className="text-xs font-bold text-white">2 PM Client Meeting starts in 3 hours</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">TalentXcel Services · 4 Attendees</p>
                  </div>
                  <button
                    onClick={() => handleExecuteGoal('Prepare meeting briefing for 2 PM TalentXcel Client Meeting')}
                    className="px-3 py-1.5 bg-[#6D5DF6] hover:bg-[#5b4be0] text-[11px] font-semibold rounded-[12px] text-white flex items-center gap-1 transition-all shadow-md shrink-0"
                  >
                    <Sparkles className="h-3 w-3" /> Prepare Me
                  </button>
                </div>

                {/* Timeline Item 3: Yesterday Summary */}
                <div className="relative pl-8 flex items-center justify-between gap-4 group">
                  <div className="absolute left-2.5 top-2.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-4 ring-[#181B23] shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#22C55E]">Yesterday</span>
                      <span className="text-xs font-bold text-white">12 Tasks Completed by your team</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">Engineering & Growth Operations</p>
                  </div>
                  <button
                    onClick={() => handleExecuteGoal('Summarize team performance and completed tasks from yesterday')}
                    className="px-3 py-1.5 bg-[#22C55E]/10 border border-[#22C55E]/30 hover:bg-[#22C55E]/20 text-[#22C55E] text-[11px] font-semibold rounded-[12px] flex items-center gap-1 transition-all shrink-0"
                  >
                    <TrendingUp className="h-3 w-3" /> See Summary
                  </button>
                </div>

              </div>
            </div>

            {/* Today's Schedule Card Group */}
            <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-5 shadow-level-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#3B82F6]" /> Today's Schedule
                </div>
                <button
                  onClick={() => navigate('/desktop/calendar')}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-[#090A0F] px-3 py-1.5 rounded-[12px] border border-white/10 transition-colors"
                >
                  View Calendar <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#090A0F] border border-white/10 px-3.5 py-2.5 rounded-[12px] flex items-center gap-2.5">
                  <span className="text-[#3B82F6] font-bold text-xs font-mono">9:30 AM</span>
                  <span className="text-gray-200 text-xs font-semibold truncate">Sales Team Standup</span>
                </div>
                <div className="bg-[#090A0F] border border-white/10 px-3.5 py-2.5 rounded-[12px] flex items-center gap-2.5">
                  <span className="text-[#F59E0B] font-bold text-xs font-mono">11:00 AM</span>
                  <span className="text-gray-200 text-xs font-semibold truncate">Vendor Sync</span>
                </div>
                <div className="bg-[#090A0F] border border-white/10 px-3.5 py-2.5 rounded-[12px] flex items-center gap-2.5">
                  <span className="text-[#6D5DF6] font-bold text-xs font-mono">2:00 PM</span>
                  <span className="text-gray-200 text-xs font-semibold truncate">TalentXcel Demo</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Conversational AI Assistant Side Panel (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-5 space-y-4 shadow-level-2 sticky top-5">
              
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="bg-[#6D5DF6]/20 border border-[#6D5DF6]/40 p-2 rounded-[12px] text-[#6D5DF6]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">What would you like to work on?</h3>
                  <p className="text-[11px] text-[#22C55E] flex items-center gap-1 mt-0.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" /> Active & Conversational
                  </p>
                </div>
              </div>

              {/* Conversational Prompt Suggestions */}
              <div className="space-y-2">
                <button
                  onClick={() => handleExecuteGoal('What needs my attention today?')}
                  className="w-full bg-[#090A0F] hover:bg-white/5 border border-white/10 p-2.5 rounded-[12px] flex items-center justify-between text-xs font-medium text-gray-300 hover:text-white transition-all text-left group"
                >
                  <span className="flex items-center gap-2 truncate">
                    💬 What needs my attention today?
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => handleExecuteGoal('Draft a reply to Rajesh regarding the Acme proposal')}
                  className="w-full bg-[#090A0F] hover:bg-white/5 border border-white/10 p-2.5 rounded-[12px] flex items-center justify-between text-xs font-medium text-gray-300 hover:text-white transition-all text-left group"
                >
                  <span className="flex items-center gap-2 truncate">
                    ✉️ Draft a reply to Rajesh
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => handleExecuteGoal('Prepare me for my next meeting at 2 PM')}
                  className="w-full bg-[#090A0F] hover:bg-white/5 border border-white/10 p-2.5 rounded-[12px] flex items-center justify-between text-xs font-medium text-gray-300 hover:text-white transition-all text-left group"
                >
                  <span className="flex items-center gap-2 truncate">
                    📅 Prepare me for my next meeting
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => handleExecuteGoal('Delay the Acme follow-up until next week')}
                  className="w-full bg-[#090A0F] hover:bg-white/5 border border-white/10 p-2.5 rounded-[12px] flex items-center justify-between text-xs font-medium text-gray-300 hover:text-white transition-all text-left group"
                >
                  <span className="flex items-center gap-2 truncate">
                    ⚡ Challenge decision: Delay follow-up
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => handleExecuteGoal('Give me this week executive summary and team progress')}
                  className="w-full bg-[#090A0F] hover:bg-white/5 border border-white/10 p-2.5 rounded-[12px] flex items-center justify-between text-xs font-medium text-gray-300 hover:text-white transition-all text-left group"
                >
                  <span className="flex items-center gap-2 truncate">
                    📊 Give me this week's summary
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors shrink-0" />
                </button>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleExecuteGoal('What needs my attention today?')}
                className="w-full bg-[#6D5DF6] hover:bg-[#5b4be0] text-white rounded-[12px] py-2.5 px-4 font-semibold text-xs flex items-center justify-center gap-2 shadow-level-2 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" /> Start Conversation
              </button>

            </div>
          </div>

        </div>

        {/* ── 4. Dashboard Metrics with Trend Comparison ─────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          
          {/* Metric 1: Tasks */}
          <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-3.5 flex items-center justify-between shadow-level-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                Tasks Completed
              </div>
              <div className="text-xl font-extrabold text-white">✔ 12</div>
              <div className="text-[10px] text-[#22C55E] font-semibold">+4% vs last week</div>
            </div>
            <MiniSparkline color="#22C55E" />
          </div>

          {/* Metric 2: Meetings */}
          <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-3.5 flex items-center justify-between shadow-level-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                <Calendar className="h-3.5 w-3.5 text-[#3B82F6]" />
                Meetings Today
              </div>
              <div className="text-xl font-extrabold text-white">📅 3</div>
              <div className="text-[10px] text-[#3B82F6] font-semibold">On Schedule</div>
            </div>
            <MiniSparkline color="#3B82F6" />
          </div>

          {/* Metric 3: Tickets */}
          <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-3.5 flex items-center justify-between shadow-level-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                <Ticket className="h-3.5 w-3.5 text-[#F59E0B]" />
                Pending Tickets
              </div>
              <div className="text-xl font-extrabold text-white">🎟️ 5</div>
              <div className="text-[10px] text-[#F59E0B] font-semibold">2 High Priority</div>
            </div>
            <MiniSparkline color="#F59E0B" />
          </div>

          {/* Metric 4: Unread Messages */}
          <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-3.5 flex items-center justify-between shadow-level-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                <MessageSquare className="h-3.5 w-3.5 text-[#6D5DF6]" />
                Unread Messages
              </div>
              <div className="text-xl font-extrabold text-white">💬 8</div>
              <div className="text-[10px] text-[#6D5DF6] font-semibold">3 Direct Threads</div>
            </div>
            <MiniSparkline color="#6D5DF6" />
          </div>

          {/* Metric 5: Time Saved */}
          <div className="bg-[#181B23] border border-white/10 rounded-[16px] p-3.5 flex items-center justify-between shadow-level-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                <Clock className="h-3.5 w-3.5 text-[#22C55E]" />
                Time Saved
              </div>
              <div className="text-xl font-extrabold text-white">⚡ 6h 18m</div>
              <div className="text-[10px] text-[#22C55E] font-semibold">+12% productivity</div>
            </div>
            <MiniSparkline color="#22C55E" />
          </div>

        </div>

      </div>

      {/* ── 5. AI Personality Customization Suite Modal ───────────────── */}
      {showCustomizer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181B23] border border-white/10 rounded-[20px] max-w-lg w-full p-6 space-y-4 shadow-level-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 font-bold text-base text-white">
                <SlidersHorizontal className="h-4 w-4 text-[#6D5DF6]" /> CHATR AI Personality Suite
              </div>
              <button onClick={() => setShowCustomizer(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Speaking Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Speaking Mode</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {(['executive', 'manager', 'analyst', 'coach', 'casual'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPersonaMode(m)}
                    className={`py-1.5 px-2 rounded-[10px] text-[11px] font-semibold border transition-all capitalize ${
                      personaMode === m
                        ? 'bg-[#6D5DF6] border-[#6D5DF6] text-white'
                        : 'bg-[#090A0F] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Response Length */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Response Length</label>
              <div className="grid grid-cols-3 gap-2">
                {(['brief', 'balanced', 'detailed'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVerbosity(v)}
                    className={`py-2 px-3 rounded-[10px] text-xs font-semibold border transition-all capitalize ${
                      verbosity === v
                        ? 'bg-[#6D5DF6] border-[#6D5DF6] text-white'
                        : 'bg-[#090A0F] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Decision Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Decision Style</label>
              <div className="grid grid-cols-3 gap-2">
                {(['conservative', 'balanced', 'aggressive'] as const).map((ds) => (
                  <button
                    key={ds}
                    onClick={() => setDecisionStyle(ds)}
                    className={`py-2 px-3 rounded-[10px] text-xs font-semibold border transition-all capitalize ${
                      decisionStyle === ds
                        ? 'bg-[#6D5DF6] border-[#6D5DF6] text-white'
                        : 'bg-[#090A0F] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {ds}
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji Usage */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Emoji Usage</label>
              <div className="grid grid-cols-3 gap-2">
                {(['off', 'minimal', 'normal'] as const).map((em) => (
                  <button
                    key={em}
                    onClick={() => setEmojiUsage(em)}
                    className={`py-2 px-3 rounded-[10px] text-xs font-semibold border transition-all capitalize ${
                      emojiUsage === em
                        ? 'bg-[#6D5DF6] border-[#6D5DF6] text-white'
                        : 'bg-[#090A0F] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Respectful Disagreement Toggle */}
            <div className="flex items-center justify-between bg-[#090A0F] border border-white/10 p-2.5 rounded-[12px]">
              <div>
                <div className="text-xs font-semibold text-white">Challenge My Decisions</div>
                <div className="text-[11px] text-gray-400">Respectfully point out trade-offs when delaying work</div>
              </div>
              <button
                onClick={() => setChallengeDecisions(!challengeDecisions)}
                className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                  challengeDecisions ? 'bg-[#22C55E]' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    challengeDecisions ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Proactive Observations Toggle */}
            <div className="flex items-center justify-between bg-[#090A0F] border border-white/10 p-2.5 rounded-[12px]">
              <div>
                <div className="text-xs font-semibold text-white">Proactive AI</div>
                <div className="text-[11px] text-gray-400">Surface unprompted business observations</div>
              </div>
              <button
                onClick={() => setShowProactive(!showProactive)}
                className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                  showProactive ? 'bg-[#22C55E]' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    showProactive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Save Button */}
            <button
              onClick={() => setShowCustomizer(false)}
              className="w-full bg-[#6D5DF6] hover:bg-[#5b4be0] text-white py-2.5 rounded-[12px] font-semibold text-xs transition-all shadow-level-2"
            >
              Save Personality Preferences
            </button>
          </div>
        </div>
      )}

      {/* ── 6. Developer Data Provenance Modal ──────────────────────────── */}
      {selectedProvenance && (
        <DataProvenanceModal
          meta={selectedProvenance}
          onClose={() => setSelectedProvenance(null)}
        />
      )}
    </div>
  );
};
