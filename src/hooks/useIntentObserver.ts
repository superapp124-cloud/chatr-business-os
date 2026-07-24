import { useState, useCallback, useRef, useEffect } from 'react';
import { detectIntents } from '@/core/intent/patterns';
import type { Understanding } from '@/core/intent/types';
import { projectionStore, ProjectionState } from '@/core/intent/projectionStore';
import { toast } from 'sonner';
import { CommitmentPlannerImpl } from '@/core/services/CommitmentPlanner';
import '@/core/capabilities/CommitmentRuntime'; // ensure runtime boots up

const CHATR_CORE_URL = 'http://127.0.0.1:8087';
const DEBOUNCE_MS = 300;
const MIN_CONFIDENCE = 0.50;

interface UseIntentObserverOptions {
  conversationId: string | null;
  userId?: string;
  workspaceId?: string;
}

interface IntentObserverState {
  understanding: Understanding | null;
  isReady: boolean;
  dismiss: () => void;
  observe: (messageText: string) => void;
  kernelMetrics: Record<string, number>; 
}

export function useIntentObserver({ conversationId, userId, workspaceId = 'default' }: UseIntentObserverOptions): IntentObserverState {
  const [projection, setProjection] = useState<ProjectionState>(projectionStore.getState());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTextRef = useRef<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Subscribe to the Projection Store
  useEffect(() => {
    const unsubscribe = projectionStore.subscribe(state => {
      // Need a new object reference to trigger re-render
      setProjection({ ...state });
    });
    return unsubscribe;
  }, []);

  const dismiss = useCallback(() => {
    projectionStore.reset();
  }, []);

  // Connect Event Router to Projection Store
  useEffect(() => {
    if (!conversationId) return;
    
    const es = new EventSource(`${CHATR_CORE_URL}/kernel/stream?scope=${workspaceId}`);
    eventSourceRef.current = es;

    const events = [
      'KERNEL.OBSERVATION.CREATED',
      'KERNEL.UNDERSTANDING.CREATED',
      'KERNEL.CONTEXT.RESOLVED',
      'KERNEL.POLICY.VERIFIED',
      'KERNEL.ACTION.REVEALED',
      'KERNEL.ACTION.EXECUTED',
      'KERNEL.JOURNAL.APPENDED',
      'KERNEL.SUGGESTION.PROPOSED',
      'KERNEL.OUTCOME.DETECTED'
    ];

    events.forEach(eventName => {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const envelope = JSON.parse(e.data);
          toast.info('4. SSE: Received ' + envelope.eventName);
          projectionStore.handleEvent({
            id: envelope.id,
            eventName: eventName,
            timestamp: envelope.timestamp,
            stage: envelope.stage,
            correlationId: envelope.correlationId,
            payload: envelope.payload
          });
        } catch (err) {
          console.error('Failed to parse SSE', err);
        }
      });
    });

    return () => {
      es.close();
    };
  }, [conversationId, workspaceId]);

  const triggerBackendObservation = useCallback((messageText: string, attachments: any[] = []) => {
    if (!conversationId) return;
    toast.info('2. Observer: Mocking backend offline planner...');
    
    // FALLBACK MOCK for local testing without backend
    let detected = detectIntents(messageText);
    
    // If no text but there are attachments, we do not force a fallback
    // to avoid popping up a broken Task widget. Attachments will be
    // handled natively by the chat input submission.

    if (detected.length > 0) {
      const planner = CommitmentPlannerImpl.getInstance();
      planner.plan({
        id: crypto.randomUUID(),
        action: messageText || `Analyze ${attachments.length} attachment(s)`,
        entities: { title: messageText || `Analyze ${attachments.length} attachment(s)` },
        attachments: attachments,
        confidence: detected[0].confidence?.observation || 0.8
      });
    }
  }, [conversationId, userId, workspaceId]);

  const latestAttachmentsRef = useRef<any[]>([]);

  const observe = useCallback((messageText: string, attachments: any[] = []) => {
    latestTextRef.current = messageText;
    latestAttachmentsRef.current = attachments;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const hasText = messageText && messageText.trim().length >= 8;
    const hasAttachments = attachments && attachments.length > 0;

    if (!hasText && !hasAttachments) {
      dismiss();
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      const text = latestTextRef.current;
      const atts = latestAttachmentsRef.current;
      const validText = text && text.trim().length >= 8;
      const validAtts = atts && atts.length > 0;

      if (!validText && !validAtts) return;

      toast.info('1. Observer: Checking pattern');
      triggerBackendObservation(text, atts);
    }, DEBOUNCE_MS);
  }, [triggerBackendObservation, dismiss]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { 
    understanding: projection.understanding, 
    isReady: projection.isReady, 
    dismiss, 
    observe, 
    kernelMetrics: projection.latencyMetrics 
  };
}
