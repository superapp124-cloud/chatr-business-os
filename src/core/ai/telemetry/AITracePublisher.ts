/**
 * CHATR Business OS — AI Execution Trace Publisher
 *
 * Emits real-time trace events onto EventBus for inspection by AITracePanel.
 */

import { EventBus } from '@/sdk/engines/EventBus';
import { AITraceStep } from '@/components/desktop/AITracePanel';

export function emitAITrace(step: Omit<AITraceStep, 'id' | 'timestamp'>): void {
  const trace: AITraceStep = {
    ...step,
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
  };

  void EventBus.publish('system_ai', 'AI_EXECUTION_TRACE', trace);
}
