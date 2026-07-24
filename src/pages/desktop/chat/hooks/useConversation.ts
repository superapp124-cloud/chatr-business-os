import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generate } from '@/services/ai';
import type { Room, Message } from '../types';

const DEFAULT_AI_ROOM: Room = {
  id: 'chatr-ai-room',
  name: 'CHATR AI',
  type: 'dm',
  unreadCount: 0,
  avatarUrl: '/chatr-icon-logo.png'
};

const INITIAL_AI_WELCOME_MSG: Message = {
  id: 'ai-welcome-msg',
  roomId: 'chatr-ai-room',
  senderId: 'chatr-ai',
  senderName: 'CHATR AI',
  content: "Hello! I am your CHATR AI Assistant. How can I assist you today with your tasks, messages, or workspace?",
  createdAt: new Date().toISOString(),
  isAi: true
};

export function useConversation(messagingService: any, currentUserId: string | null) {
  const [rooms, setRooms] = useState<Room[]>([DEFAULT_AI_ROOM]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [peerUsername, setPeerUsername] = useState<string | null>(null);
  
  const unsubRef = useRef<() => void>(null);

  useEffect(() => {
    let active = true;
    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const rs = await messagingService.getRooms();
        if (active) {
          const hasAiRoom = rs.some((r: Room) => r.name === 'CHATR AI' || r.id === 'chatr-ai-room');
          const finalRooms = hasAiRoom ? rs : [DEFAULT_AI_ROOM, ...rs];
          setRooms(finalRooms);
        }
      } catch (e: any) {
        toast.error('Failed to load rooms');
        if (active) setRooms([DEFAULT_AI_ROOM]);
      } finally {
        if (active) setIsLoadingRooms(false);
      }
    };
    fetchRooms();
    return () => { active = false; };
  }, [messagingService]);

  useEffect(() => {
    let active = true;
    if (!selectedId) {
      setMessages([]);
      setPeerUsername(null);
      return;
    }
    
    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        if (selectedId === 'chatr-ai-room') {
          if (active) {
            setMessages(prev => prev.length > 0 ? prev : [INITIAL_AI_WELCOME_MSG]);
          }
          return;
        }
        const msgs = await messagingService.getMessages(selectedId);
        if (active) setMessages(msgs);
      } catch (e: any) {
        console.error(e);
      } finally {
        if (active) setIsLoadingMessages(false);
      }
    };
    fetchMessages();

    // Setup realtime
    if (unsubRef.current) unsubRef.current();
    if (selectedId !== 'chatr-ai-room') {
      unsubRef.current = messagingService.subscribeToRoom(selectedId, (newMsg: Message) => {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      });
    }

    return () => {
      active = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [selectedId, messagingService]);

  useEffect(() => {
    if (selectedId && currentUserId) {
      const room = rooms.find(r => r.id === selectedId);
      if (room?.type === 'dm' && room.id !== 'chatr-ai-room') {
        const fetchPeer = async () => {
          const p = room.participants?.find(p => p !== currentUserId);
          if (!p) return;
          const { data } = await supabase.from('profiles').select('username').eq('id', p).single();
          if (data) setPeerUsername(data.username);
        };
        fetchPeer();
      } else {
        setPeerUsername(null);
      }
    }
  }, [selectedId, currentUserId, rooms]);

  const sendMessage = useCallback(async (content: string, attachments?: any[]) => {
    if (!selectedId || (!content.trim() && (!attachments || attachments.length === 0))) return;

    const isAiRoom = selectedId === 'chatr-ai-room' || rooms.find(r => r.id === selectedId)?.name === 'CHATR AI';
    
    if (isAiRoom) {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        roomId: selectedId,
        senderId: currentUserId || 'me',
        senderName: 'Me',
        content,
        createdAt: new Date().toISOString(),
        attachments
      };

      setMessages(prev => [...prev, userMsg]);
      setIsAiLoading(true);

      try {
        const aiResponseText = await generate({
          prompt: `You are CHATR AI, an executive workspace assistant embedded in CHATR. Respond concisely and helpfully to the user's message: "${content}"`,
          systemPrompt: "You are CHATR AI, an intelligent workspace AI assistant."
        });

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          roomId: selectedId,
          senderId: 'chatr-ai',
          senderName: 'CHATR AI',
          content: aiResponseText || "I've processed your request.",
          createdAt: new Date().toISOString(),
          isAi: true
        };

        setMessages(prev => [...prev, aiMsg]);
      } catch (err) {
        toast.error("Failed to generate CHATR AI response");
      } finally {
        setIsAiLoading(false);
      }
      return;
    }

    try {
      await messagingService.sendMessage(selectedId, content, attachments || []);
    } catch (e: any) {
      toast.error('Failed to send message');
    }
  }, [selectedId, currentUserId, rooms, messagingService]);

  return {
    rooms,
    messages,
    selectedId,
    setSelectedId,
    isLoadingRooms,
    isLoadingMessages,
    isAiLoading,
    peerUsername,
    sendMessage
  };
}
