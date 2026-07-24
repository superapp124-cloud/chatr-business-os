import { useState, useRef, useCallback, useEffect } from 'react';
import { generate } from '@/services/ai';
import { kernelBus } from '@/kernel/core/EventBus';
import { toast } from 'sonner';
import { triggerCabBooking } from '@/core/capabilities/travel/CabBookingWorkflow';
import { triggerCalendarMeeting } from '@/core/capabilities/calendar/CalendarMeetingWorkflow';
import { triggerFoodOrdering } from '@/core/capabilities/commerce/FoodOrderingWorkflow';
import { triggerWeatherWorkflow } from '@/core/capabilities/weather/WeatherWorkflow';
import { triggerFlightBooking } from '@/core/capabilities/travel/FlightBookingWorkflow';
import { triggerDocumentUnderstanding } from '@/core/capabilities/document/DocumentUnderstandingWorkflow';
import type { CopilotMessage, Room } from '../types';

export function useCopilot() {
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotAttachments, setCopilotAttachments] = useState<File[]>([]);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const copilotEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKernelEvent = (event: any) => {
      const intentId = event.intentId || event.payload?.intentId;
      if (!intentId) return;

      const mapEventToStatus = (type: string) => {
        if (type === 'process.spawned') return 'Understanding...';
        if (type === 'capability.discovery' || type === 'process.discovery_completed') return 'Finding the best option...';
        if (type === 'capability.ranking' || type === 'process.ranking_completed') return 'Comparing options...';
        if (type === 'execution.started') return 'Working...';
        if (type === 'verification.completed' || type === 'process.completed') return 'Finished.';
        if (type === 'process.failed') return 'Failed.';
        return null;
      };

      const statusMsg = mapEventToStatus(event.type);
      if (!statusMsg) return;

      setCopilotMessages(prev => prev.map(msg => {
        if (msg.workflowId === intentId) {
          const isFinished = statusMsg === 'Finished.';
          const progress = msg.executionProgress ? [...msg.executionProgress] : [];
          if (!progress.some(p => p.status === statusMsg)) {
            progress.push({ status: statusMsg, timestamp: Date.now() });
          }
          return { 
            ...msg, 
            isResolving: !isFinished, 
            executionProgress: progress,
            ...(isFinished ? {
              confidence: 'HIGH' as const,
              explainability: { fastest: true, live: true, verified: true }
            } : {})
          };
        }
        return msg;
      }));
    };

    const subs = [
      'process.spawned', 'process.discovery_completed', 'process.ranking_completed', 
      'execution.started', 'process.completed', 'process.failed'
    ];
    subs.forEach(s => kernelBus.subscribe(s, handleKernelEvent));
    return () => {
      // Memory cleanup for kernelBus normally happens here.
    };
  }, []);

  const handleCopilotSubmit = useCallback(async (e: React.FormEvent, selectedRoom?: Room) => {
    e.preventDefault();
    if ((!copilotInput.trim() && copilotAttachments.length === 0) || copilotLoading) return;

    const userMsg = copilotInput.trim();
    const currentAttachments = [...copilotAttachments];
    setCopilotInput('');
    setCopilotAttachments([]);
    setCopilotMessages(prev => [...prev, { role: 'user', content: userMsg || `[Attached ${currentAttachments.length} document(s)]` }]);
    
    // ─── Attachments / Document Understanding ────────────────────────────────
    if (currentAttachments.length > 0) {
      const workflowId = triggerDocumentUnderstanding(currentAttachments, userMsg);
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `I'll analyze those ${currentAttachments.length} document(s) for you.`, workflowId, isResolving: true, executionProgress: [{ status: 'Understanding...', timestamp: Date.now() }] }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }
    
    // ─── Intent Detection ────────────────────────────────────────────────────
    const CAB_BOOKING_PATTERNS = [
      /book.{0,15}cab/i,
      /book.{0,15}ride/i,
      /book.{0,15}auto/i,
      /get.{0,15}cab/i,
      /need.{0,15}cab/i,
      /\bola\b|\buber\b|\brapido\b/i,
      /book.{0,15}taxi/i,
      /cab.{0,15}to\b/i,
      /ride.{0,15}to\b/i,
      /drop.{0,15}me\b/i,
      /pick.{0,10}me.{0,10}up/i,
      /take.{0,10}me.{0,10}to/i,
    ];

    if (CAB_BOOKING_PATTERNS.some(p => p.test(userMsg))) {
      const conversationId = `conv-${Date.now()}`;
      const workflowId = await triggerCabBooking(conversationId, { rawText: userMsg });
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: "Sure, I'll book a cab for you. Working on it...", workflowId, isResolving: true, executionProgress: [{ status: 'Understanding...', timestamp: Date.now() }] }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }

    const CALENDAR_MEETING_PATTERNS = [
      /schedule.{0,15}meeting/i,
      /book.{0,15}meeting/i,
      /set up.{0,15}meeting/i,
      /arrange.{0,15}meeting/i,
      /create.{0,15}meeting/i,
      /schedule.{0,15}call/i,
      /book.{0,15}call/i,
    ];

    if (CALENDAR_MEETING_PATTERNS.some(p => p.test(userMsg))) {
      const conversationId = `conv-${Date.now()}`;
      
      let attendees = 'Team';
      const match = userMsg.match(/with\s+([a-zA-Z\s]+)(?:for|next|tomorrow|$)/i);
      if (match) attendees = match[1].trim();

      const workflowId = await triggerCalendarMeeting(conversationId, { rawText: userMsg, attendees });
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `I'll help you schedule a meeting with ${attendees}. Checking calendars...`, workflowId, isResolving: true, executionProgress: [{ status: 'Understanding...', timestamp: Date.now() }] }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }

    const FOOD_ORDERING_PATTERNS = [
      /hungry/i,
      /order.{0,15}food/i,
      /order.{0,15}pizza/i,
      /order.{0,15}burger/i,
      /order.{0,15}biryani/i,
      /order.{0,15}sushi/i,
      /order.{0,15}dosa/i,
      /order.{0,15}noodles/i,
      /get.{0,15}food/i,
      /get.{0,15}pizza/i,
      /i want.{0,15}food/i,
      /i want.{0,15}pizza/i,
      /i want.{0,15}biryani/i,
      /food.{0,15}deliver/i,
      /swiggy|zomato/i,
    ];

    const WEATHER_PATTERNS = [
      /weather/i,
      /temperature/i,
      /how hot/i,
      /how cold/i,
      /forecast/i,
    ];

    if (WEATHER_PATTERNS.some(p => p.test(userMsg))) {
      const conversationId = `conv-${Date.now()}`;
      
      const workflowId = await triggerWeatherWorkflow(conversationId, { location: userMsg });
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `Checking the live weather for you...`, workflowId, isResolving: true, executionProgress: [{ status: 'Understanding...', timestamp: Date.now() }] }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }

    if (FOOD_ORDERING_PATTERNS.some(p => p.test(userMsg))) {
      const conversationId = `conv-${Date.now()}`;
      
      let foodItem = 'food';
      const foodMap: Record<string, string> = {
        pizza: 'Pizza', burger: 'Burger', sushi: 'Sushi',
        biryani: 'Biryani', dosa: 'Dosa', noodles: 'Noodles',
      };
      const msgLower = userMsg.toLowerCase();
      for (const [key, label] of Object.entries(foodMap)) {
        if (msgLower.includes(key)) { foodItem = label; break; }
      }

      const workflowId = await triggerFoodOrdering(conversationId, { rawText: userMsg, foodItem });
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `I'll help you order some ${foodItem.toLowerCase()}. Looking for the best places nearby...`, workflowId, isResolving: true, executionProgress: [{ status: 'Understanding...', timestamp: Date.now() }] }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }

    const FLIGHT_PATTERNS = [
      /book.{0,20}flight/i,
      /flight.{0,20}book/i,
      /book.{0,20}ticket/i,
      /flight.{0,20}tomorrow/i,
      /get me there on time/i,
      /catch my flight/i,
      /fly.{0,15}to\b/i,
      /flight.{0,15}to\b/i,
      /travel.{0,15}to\b/i,
      /need.{0,15}flight/i,
    ];

    if (FLIGHT_PATTERNS.some(p => p.test(userMsg))) {
      const conversationId = `conv-${Date.now()}`;
      
      const workflowId = await triggerFlightBooking(conversationId, { rawText: userMsg });
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `I'll make sure you catch your flight. Let me coordinate everything for you...`, workflowId, isResolving: true, executionProgress: [{ status: 'Understanding...', timestamp: Date.now() }] }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }

    const ENTERPRISE_APPROVAL_PATTERNS = [
      /access.{0,10}production/i,
      /request.{0,10}access/i,
      /need.{0,10}database/i,
    ];

    if (ENTERPRISE_APPROVAL_PATTERNS.some(p => p.test(userMsg))) {
      const conversationId = `conv-${Date.now()}`;
      
      const workflowId = await triggerEnterpriseApproval(conversationId, { rawText: userMsg });
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `I'll help you request access. Checking IAM policies...`, workflowId }]);
      setTimeout(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      return;
    }

    setCopilotLoading(true);
    
    // Auto-scroll
    setTimeout(() => {
      copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const context = selectedRoom ? `The user is currently in a chat named "${selectedRoom.name}". ` : '';
      const response = await generate({
        prompt: userMsg,
        systemPrompt: `You are CHATR Copilot, an AI assistant built into the CHATR Desktop OS. ${context} Answer concisely and help the user navigate their operating system.`,
      });

      setCopilotMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e: any) {
      toast.error('Failed to get response from Copilot');
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please check your Ollama connection or try again later.' }]);
    } finally {
      setCopilotLoading(false);
      setTimeout(() => {
        copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [copilotInput, copilotLoading, copilotAttachments]);

  return {
    copilotInput,
    setCopilotInput,
    copilotAttachments,
    setCopilotAttachments,
    copilotMessages,
    copilotLoading,
    copilotEndRef,
    handleCopilotSubmit
  };
}
