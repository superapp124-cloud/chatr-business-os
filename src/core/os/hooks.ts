import { useContext } from 'react';
import { CHATROSContext } from './GlobalIntentProvider';
import type { CHATROSState } from './GlobalIntentProvider';
import { pageContextEngine } from './PageContextEngine';
import type { ExtractedKnowledge } from './KnowledgeEngine';

const EMPTY_KNOWLEDGE: ExtractedKnowledge = {
  people: [],
  dates: [],
  dateLabels: [],
  topics: [],
  companies: [],
  intents: []
};

import { ChatrOSContext } from '@/components/ChatrOSProvider';
import { NativeAppContext } from '@/components/NativeAppProvider';

/** Use on any page or component to access the global CHATR OS state */
export function useCHATROS(): CHATROSState {
  const ctx = useContext(CHATROSContext);
  if (!ctx) {
    // Graceful fallback so pages don't crash if not inside provider
    const route = typeof window !== 'undefined' ? window.location.pathname : '/';
    const pageContext = pageContextEngine.getContextForRoute(route);
    return {
      pageContext,
      aiMode: pageContext.aiMode,
      knowledge: EMPTY_KNOWLEDGE,
      commitments: [],
      scheduledToday: [],
      scheduledUpcoming: [],
      observeText: () => {},
      addCommitment: () => {},
    };
  }
  return ctx;
}

export const useChatrOS = () => useContext(ChatrOSContext);

export const useNativeApp = () => useContext(NativeAppContext);
