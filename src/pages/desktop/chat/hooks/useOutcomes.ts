import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { eventBus } from '@/core/runtime/EventBus';
import { commitmentRuntime } from '@/core/capabilities/CommitmentRuntime';

export function useOutcomes(selectedId: string | null, currentUser: any) {
  const [outcomes, setOutcomes] = useState<any[]>([]);

  useEffect(() => {
    const handleOutcomesDetected = (e: any) => {
      const detectedOutcomes = e.detail;
      detectedOutcomes.forEach((o: any) => commitmentRuntime.processCommitment(o));
    };

    const handleNewCommitmentEvent = (e: any) => {
      const commitment = e.payload.commitment;
      setOutcomes(prev => {
        // If it's already there, just update it, else append it
        const existingIndex = prev.findIndex(o => o.id === commitment.id);
        if (existingIndex >= 0) {
           const next = [...prev];
           next[existingIndex] = commitment;
           return next;
        }
        
        // Remove old states of any commitment (if necessary) or just append
        const filtered = prev.filter(o => o.status !== 'detected' && o.status !== 'validated');
        return [...filtered, commitment];
      });
      window.dispatchEvent(new CustomEvent('chatr:open-outcomes-pane'));
    };

    const handleCommitmentStateChanged = (e: any) => {
      const commitment = e.payload;
      setOutcomes(prev => prev.map(o => o.id === commitment.id ? commitment : o));
    };

    const handleRealityVerified = (e: any) => {
      const { commitment } = e.payload;
      setOutcomes(prev => prev.map(o => o.id === commitment.id ? commitment : o));

      if (selectedId && currentUser) {
        let actionType = 'task';
        if (commitment.capability === 'core.flight_booking' || commitment.capability === 'core.hotel_booking') actionType = 'book';
        if (commitment.capability === 'core.candidate_interview' || commitment.capability === 'core.meeting' || commitment.capability === 'core.calendar_event') actionType = 'message';
        
        const sysMsg = {
          room_id: selectedId,
          content: `${commitment.title}`,
          sender_id: currentUser.id,
          type: 'system',
          metadata: { 
            isAction: true,
            actionType: actionType,
            actionTitle: `${commitment.type || commitment.capability} Completed`,
            actionDescription: e.payload.reality?.message + (e.payload.reality?.evidence?.pnr ? ` (PNR: ${e.payload.reality.evidence.pnr})` : '') || commitment.title,
            actionData: { 
              ...commitment.entities, 
              ...commitment.selectedResult,
              ...e.payload.reality?.evidence 
            }
          }
        };
        
        supabase.from('messages').insert(sysMsg).then(({ error }) => {
          if (error) console.error('Failed to save action message:', error);
        });
      }
    };

    window.addEventListener('chatr:outcomes-detected', handleOutcomesDetected);
    
    eventBus.subscribe('chatr:commitment-suggested', handleNewCommitmentEvent);
    eventBus.subscribe('chatr:commitment-policy-blocked', handleNewCommitmentEvent);
    eventBus.subscribe('chatr:commitment-approval-required', handleNewCommitmentEvent);
    eventBus.subscribe('chatr:commitment-permission-denied', handleNewCommitmentEvent);
    
    eventBus.subscribe('chatr:commitment-state-changed', handleCommitmentStateChanged);
    eventBus.subscribe('chatr:reality-verified', handleRealityVerified);
    
    return () => {
      window.removeEventListener('chatr:outcomes-detected', handleOutcomesDetected);
      eventBus.unsubscribe('chatr:commitment-suggested', handleNewCommitmentEvent);
      eventBus.unsubscribe('chatr:commitment-policy-blocked', handleNewCommitmentEvent);
      eventBus.unsubscribe('chatr:commitment-approval-required', handleNewCommitmentEvent);
      eventBus.unsubscribe('chatr:commitment-permission-denied', handleNewCommitmentEvent);
      
      eventBus.unsubscribe('chatr:commitment-state-changed', handleCommitmentStateChanged);
      eventBus.unsubscribe('chatr:reality-verified', handleRealityVerified);
    };
  }, [selectedId, currentUser]);

  return { outcomes, setOutcomes };
}
