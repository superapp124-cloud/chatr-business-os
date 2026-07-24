import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useService } from '@/platform/Infrastructure/PlatformContext';
import { generate } from '@/services/ai';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useCall } from '@/contexts/CallContext';
import { AnimatePresence } from 'framer-motion';

import { ChatHeader } from './chat/components/ChatHeader';
import { ConversationSidebar } from './chat/components/ConversationSidebar';
import { DashboardCenterPanel } from './chat/components/DashboardCenter/DashboardCenterPanel';
import { RightContextPanel } from './chat/components/RightContext/RightContextPanel';
import { MessageViewport } from './chat/components/MessageViewport';
import { MessageComposer } from './chat/components/MessageComposer';
import { RightPane } from './chat/components/RightPane';
import { ForwardModal } from './chat/components/ForwardModal';
import { CreateNewModal } from './chat/components/CreateNewModal';
import { UniversalSearch } from '@/components/desktop/UniversalSearch';
import { NewChatSheet } from '@/components/chatr/NewChatSheet';
import { AttachmentZone } from '@/components/chatr/AttachmentZone';
import { attachmentEngine } from '@/core/services/AttachmentEngine';
import { OutcomeCard } from '@/components/outcomes/OutcomeCard';
import { useIntentObserver } from '@/hooks/useIntentObserver';
import { useCHATROS } from '@/core/os/hooks';
import { ExperienceProvider } from '@/providers/ExperienceProvider';

import { useConversation } from './chat/hooks/useConversation';
import { useCopilot } from './chat/hooks/useCopilot';
import { useOutcomes } from './chat/hooks/useOutcomes';
import type { Message, Room, RightPaneTab } from './chat/types';

export default function DesktopChat() {
 const { themeMode } = useAppearanceStore();
 const [searchParams] = useSearchParams();
 const navigate = useNavigate();
 const { startCall } = useCall();
 const messagingService = useService<any>('MessagingService');

 // Core Hooks
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const { 
 rooms, 
 messages, 
 selectedId, 
 setSelectedId, 
 isLoadingRooms, 
 isLoadingMessages, 
 isAiLoading: isConvAiLoading,
 peerUsername,
 sendMessage
 } = useConversation(messagingService, currentUserId);
 
 const { outcomes, setOutcomes } = useOutcomes(selectedId, currentUserId ? { id: currentUserId } : null);
 const { 
 copilotInput, 
 setCopilotInput, 
 copilotAttachments,
 setCopilotAttachments,
 copilotMessages, 
 copilotLoading, 
 copilotEndRef, 
 handleCopilotSubmit 
 } = useCopilot();

 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showNewDmModal, setShowNewDmModal] = useState(false);
 const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
 const [rightPaneTab, setRightPaneTab] = useState<RightPaneTab>('copilot');
 const [messageInput, setMessageInput] = useState('');
 const [attachments, setAttachments] = useState<any[]>([]);

 const { scheduledToday, scheduledUpcoming } = useCHATROS();
 const allTasks = [...scheduledToday, ...scheduledUpcoming].filter(t => t.type === 'task' || t.type === 'reminder');
 const allEvents = [...scheduledToday, ...scheduledUpcoming].filter(t => t.type === 'meeting' || t.type === 'calendar_event');

 // Intent Observer — detects commitments as user types
 const intentObserver = useIntentObserver({ conversationId: selectedId, userId: currentUserId || undefined });

 // Watch messageInput and feed to intent observer
 useEffect(() => {
 intentObserver.observe(messageInput, attachments);
 }, [messageInput, attachments]);
 const [threadInput, setThreadInput] = useState('');
 
 const [isUploading, setIsUploading] = useState(false);
 const [isAiLoading, setIsAiLoading] = useState(false);
 const [isRewriting, setIsRewriting] = useState(false);
 const [isExtracting, setIsExtracting] = useState(false);
 const [typingUsers, setTypingUsers] = useState<Record<string, NodeJS.Timeout>>({});
 
 const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
 
 const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
 const [forwardSearchQuery, setForwardSearchQuery] = useState('');
 const [forwardSelectedRooms, setForwardSelectedRooms] = useState<Set<string>>(new Set());
 const [isForwarding, setIsForwarding] = useState(false);

 // Load Initial User
 useEffect(() => {
 supabase.auth.getUser().then(({ data }) => {
 if (data.user) setCurrentUserId(data.user.id);
 });
 }, []);

 // Handle Query Params & Global Events
 useEffect(() => {
 const id = searchParams.get('id');
 if (id) {
 setSelectedId(id);
 }
 
 // Global Event Listeners for QuickActionsBar
 const handleNewChat = () => setShowNewDmModal(true);
 const handleNewGroup = () => setShowCreateModal(true);
 const handleNewCall = () => {
 // If we are in a room, start call, otherwise open new dm modal
 if (selectedId) startCall(selectedId, rooms.find(r => r.id === selectedId)?.name || 'Unknown', true);
 else setShowNewDmModal(true);
 };
 const handleNewVideo = () => {
 if (selectedId) startCall(selectedId, rooms.find(r => r.id === selectedId)?.name || 'Unknown', false);
 else setShowNewDmModal(true);
 };
 const handleOpenChatrAI = () => {
 const aiRoom = rooms.find(r => r.name === 'CHATR AI' || r.id === 'chatr-ai-room');
 setSelectedId(aiRoom ? aiRoom.id : 'chatr-ai-room');
 };

 window.addEventListener('open-new-chat', handleNewChat);
 window.addEventListener('open-new-group', handleNewGroup);
 window.addEventListener('open-new-call', handleNewCall);
 window.addEventListener('open-new-video', handleNewVideo);
 window.addEventListener('open-chatr-ai', handleOpenChatrAI);
 window.addEventListener('chatr:open-ai', handleOpenChatrAI);

 // Listen for event to open outcomes pane
 const handleOpenOutcomesPane = () => setRightPaneTab('outcomes' as RightPaneTab);
 window.addEventListener('chatr:open-outcomes-pane', handleOpenOutcomesPane);

 return () => {
 window.removeEventListener('open-new-chat', handleNewChat);
 window.removeEventListener('open-new-group', handleNewGroup);
 window.removeEventListener('open-new-call', handleNewCall);
 window.removeEventListener('open-new-video', handleNewVideo);
 window.removeEventListener('open-chatr-ai', handleOpenChatrAI);
 window.removeEventListener('chatr:open-ai', handleOpenChatrAI);
 window.removeEventListener('chatr:open-outcomes-pane', handleOpenOutcomesPane);
 };
 }, [searchParams, setSelectedId, selectedId, rooms, startCall]);

 // Derived State
 const selectedRoom = useMemo(() => rooms.find(r => r.id === selectedId) || null, [rooms, selectedId]);

 // Handlers
 const handleSendMessage = useCallback(async () => {
 if (!messageInput.trim() && attachments.length === 0) return;
 const content = messageInput;
 const currentAttachments = [...attachments];
 setMessageInput('');
 setAttachments([]);
 await sendMessage(content, currentAttachments);
 }, [messageInput, attachments, sendMessage]);

 const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSendMessage();
 }
 }, [handleSendMessage]);

 const handleSmartReply = useCallback(async () => {
 if (!selectedRoom || messages.length === 0) return;
 setIsAiLoading(true);
 try {
 const recent = messages.slice(-5).map(m => m.content).join('\n');
 const response = await generate({
 prompt: `Suggest a short, professional reply to this conversation:\n${recent}`,
 systemPrompt: "You are an assistant. Provide a single short sentence reply. No quotes."
 });
 setMessageInput(response);
 } catch {
 toast.error('Failed to generate smart reply');
 } finally {
 setIsAiLoading(false);
 }
 }, [selectedRoom, messages]);

 const handleRewrite = useCallback(async () => {
 if (!messageInput.trim()) return;
 setIsRewriting(true);
 try {
 const response = await generate({
 prompt: `Rewrite this message to be more professional and concise:\n${messageInput}`,
 systemPrompt: "You are an assistant. Provide only the rewritten text. No quotes."
 });
 setMessageInput(response);
 } catch {
 toast.error('Failed to rewrite message');
 } finally {
 setIsRewriting(false);
 }
 }, [messageInput]);

 const handleExtractActions = useCallback(async () => {
 toast.info("Extracting actions via OS Kernel...");
 import('@/core/runtime/EventBus').then(({ eventBus }) => {
 eventBus.publish('ui:interaction', { type: 'extract_actions', payload: { roomId: selectedId } });
 });
 }, [selectedId]);

 const handleFilePicker = useCallback((accept: string) => {
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = accept;
 input.multiple = true;
 input.style.display = 'none';
 document.body.appendChild(input);
 input.onchange = async (e: any) => {
 const files = Array.from(e.target.files || []) as File[];
 if (files.length > 0 && selectedId) {
 setIsUploading(true);
 try {
 const newAttachments = [];
 for (const file of files) {
 const attachment = await attachmentEngine.uploadFile(file);
 newAttachments.push(attachment);
 }
 setAttachments(prev => [...prev, ...newAttachments]);
 toast.success(`Attached ${files.length} file(s)`);
 } catch (err) {
 toast.error('Failed to attach file(s)');
 } finally {
 setIsUploading(false);
 }
 }
 document.body.removeChild(input);
 };
 input.click(); // Trigger the native file picker
 
 // Clean up if the user cancels the dialog (since onchange won't fire)
 // We add a slight delay to allow the dialog to open first
 setTimeout(() => {
 if (document.body.contains(input)) {
 // We can't actually detect cancellation perfectly in all browsers,
 // but adding this ensures it eventually cleans up if not triggered.
 window.addEventListener('focus', () => {
 setTimeout(() => {
 if (document.body.contains(input)) document.body.removeChild(input);
 }, 1000);
 }, { once: true });
 }
 }, 100);
 }, [selectedId]);

 const handleSendThreadReply = useCallback(async () => {
 if (!threadInput.trim() || !activeThreadId || !selectedId) return;
 const content = threadInput;
 setThreadInput('');
 try {
 await messagingService.sendMessage(selectedId, content, [], activeThreadId);
 } catch {
 toast.error('Failed to reply to thread');
 }
 }, [threadInput, activeThreadId, selectedId]);

 const handleCopilotSendWrapper = useCallback((msg?: string) => {
 if (msg) setCopilotInput(msg);
 handleCopilotSubmit({ preventDefault: () => {} } as any, selectedRoom!);
 }, [setCopilotInput, handleCopilotSubmit, selectedRoom]);

 const handleExtractOS = useCallback(async () => {
 setIsExtracting(true);
 try {
 const context = messages.slice(-15).map(m => `${m.senderId === currentUserId ? 'Me' : 'User'}: ${m.content}`).join('\n');
 const response = await generate({
 prompt: `Extract actionable items from this chat:\n${context}`,
 systemPrompt: "You are an OS extraction tool. Return JSON representing tasks, decisions, and calendar events."
 });
 toast.success("Extracted OS items successfully.");
 } catch {
 toast.error("Failed to extract");
 } finally {
 setIsExtracting(false);
 }
 }, [messages, currentUserId]);

 const executeForward = useCallback(async () => {
 if (!forwardMessage || forwardSelectedRooms.size === 0) return;
 setIsForwarding(true);
 try {
 for (const roomId of forwardSelectedRooms) {
 await messagingService.sendMessage(roomId, forwardMessage.content, forwardMessage.attachments || []);
 }
 toast.success(`Forwarded to ${forwardSelectedRooms.size} chat(s)`);
 setForwardMessage(null);
 setForwardSelectedRooms(new Set());
 } catch (error) {
 toast.error('Failed to forward message');
 } finally {
 setIsForwarding(false);
 }
 }, [forwardMessage, forwardSelectedRooms]);

 return (
 <ExperienceProvider>
 <div className={`h-full w-full flex bg-[#0b0b14] overflow-hidden ${themeMode === 'light' ? 'theme-light' : ''}`}>
 
 <ConversationSidebar 
 rooms={rooms}
 selectedId={selectedId}
 isLoadingRooms={isLoadingRooms}
 setSelectedId={setSelectedId}
 setShowNewDmModal={setShowNewDmModal}
 setShowCreateModal={setShowCreateModal}
 />

 {/* Center Pane */}
 <div className="flex-1 flex flex-col min-w-0 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
 <div className="absolute inset-0 bg-zinc-950/95" />
 
 {!selectedRoom ? (
 <div className="flex-1 flex flex-col relative z-10 min-h-0">
 <DashboardCenterPanel 
 onCreateNew={() => setShowCreateModal(true)}
 onNewChat={() => setShowNewDmModal(true)}
 />
 {/* Intent Outcome Popup — floats at the bottom of the dashboard */}
 <div className="absolute bottom-6 left-0 w-full z-50 flex flex-col justify-end gap-2 px-8 max-w-5xl mx-auto pointer-events-none">
 <AnimatePresence>
 {outcomes.filter(o => ['suggested', 'needs_input', 'searching', 'results_ready', 'preview_ready', 'executing', 'approval_required', 'policy_blocked', 'permission_denied'].includes(o.status)).map(o => (
 <div key={o.id} className="pointer-events-auto">
 <OutcomeCard outcome={o} />
 </div>
 ))}
 </AnimatePresence>
 </div>
 </div>
 ) : (
 <div className="flex-1 flex flex-col relative z-10 min-h-0">
 <ChatHeader 
 selectedRoom={selectedRoom as any} 
 onCall={() => startCall(selectedRoom.id, selectedRoom.name, true)}
 onVideoCall={() => startCall(selectedRoom.id, selectedRoom.name, false)}
 />
 
 <MessageViewport 
 messages={messages}
 currentUserId={currentUserId}
 isUploading={isUploading}
 isAiLoading={isAiLoading || isConvAiLoading}
 typingUsers={typingUsers}
 onFullscreenImage={setFullscreenImage}
 onReact={(msg) => toast.success('Reacted')}
 onReply={(msg) => { setActiveThreadId(msg.id); setRightPaneTab('copilot'); }}
 onForward={(msg) => setForwardMessage(msg)}
 onAskAI={(msg) => { setRightPaneTab('copilot'); setCopilotInput(`Explain: ${msg.content}`); }}
 />

 {/* Intent Outcome Popup — floats above message composer */}
 <div className="relative">
 <AnimatePresence>
 {outcomes.filter(o => ['suggested', 'needs_input', 'searching', 'results_ready', 'preview_ready', 'executing', 'approval_required', 'policy_blocked', 'permission_denied'].includes(o.status)).map(o => (
 <div key={o.id} className="absolute bottom-full left-0 w-full mb-2 z-50 flex flex-col justify-end gap-2 px-4 max-w-4xl mx-auto">
 <OutcomeCard outcome={o} />
 </div>
 ))}
 </AnimatePresence>

 <AttachmentZone 
 attachments={attachments}
 onAttachmentsChange={setAttachments}
 />
 <MessageComposer 
 messageInput={messageInput}
 setMessageInput={setMessageInput}
 selectedRoomName={selectedRoom.name}
 isRewriting={isRewriting}
 onSendMessage={handleSendMessage}
 onKeyDown={handleInputKeyDown}
 onFilePicker={handleFilePicker}
 onSmartReply={handleSmartReply}
 onRewrite={handleRewrite}
 onExtractActions={handleExtractActions}
 />
 </div>
 </div>
 )}
 </div>

 {!selectedRoom ? (
 <RightContextPanel />
 ) : (
 <RightPane 
 selectedRoom={selectedRoom}
 activeThreadId={activeThreadId}
 setActiveThreadId={setActiveThreadId}
 rightPaneTab={rightPaneTab}
 setRightPaneTab={setRightPaneTab}
 chatMessages={messages}
 currentUserId={currentUserId}
 copilotMessages={copilotMessages}
 copilotInput={copilotInput}
 setCopilotInput={setCopilotInput}
 copilotAttachments={copilotAttachments}
 setCopilotAttachments={setCopilotAttachments}
 copilotLoading={copilotLoading}
 copilotEndRef={copilotEndRef}
 onCopilotSend={handleCopilotSendWrapper}
 onExtract={handleExtractOS}
 isExtracting={isExtracting}
 osTasks={allTasks}
 osDecisions={[]}
 osNotes={[]}
 osEvents={allEvents}
 threadInput={threadInput}
 setThreadInput={setThreadInput}
 onSendThreadReply={handleSendThreadReply}
 onFullscreenImage={setFullscreenImage}
 />
 )}
 <CreateNewModal 
 isOpen={showCreateModal} 
 onClose={() => setShowCreateModal(false)} 
 onSelect={(id) => {
 setShowCreateModal(false);
 if (id === 'community') navigate('/create-community');
 else navigate('/contacts');
 }}
 />

 <NewChatSheet
 userId={currentUserId || ''}
 open={showNewDmModal}
 onOpenChange={setShowNewDmModal}
 onSelectContact={(contactUserId) => {
 setShowNewDmModal(false);
 toast.success('Chat created (mock)');
 }}
 />

 <ForwardModal 
 forwardMessage={forwardMessage}
 rooms={rooms}
 selectedId={selectedId}
 forwardSearchQuery={forwardSearchQuery}
 setForwardSearchQuery={setForwardSearchQuery}
 forwardSelectedRooms={forwardSelectedRooms}
 setForwardSelectedRooms={setForwardSelectedRooms}
 isForwarding={isForwarding}
 onClose={() => { setForwardMessage(null); setForwardSelectedRooms(new Set()); }}
 onForward={executeForward}
 />

 {fullscreenImage && (
 <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200" onClick={() => setFullscreenImage(null)}>
 <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors text-white z-50">
 <X className="w-5 h-5" />
 </button>
 <img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Fullscreen attachment" onClick={e => e.stopPropagation()} />
 </div>
 )}

 <UniversalSearch />
 </div>
 </ExperienceProvider>
 );
}
