/// <reference types="vite/client" />

type ChatrAIPhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'starting'
  | 'pulling'
  | 'ready'
  | 'error'
  | 'cloud_fallback';

interface ChatrAIStatus {
  phase: ChatrAIPhase;
  readyModels: string[];
  downloadProgress: number;
  pullProgress: number;
  error: string | null;
  currentModel?: string;
  warning?: string;
  message?: string;
}

interface Window {
  electronAPI?: {
    on: (channel: string, func: (...args: any[]) => void) => void;
    off?: (channel: string, func: (...args: any[]) => void) => void;
    send: (channel: string, data?: any) => void;
    invoke: (channel: string, data?: any) => Promise<any>;
    setBadgeCount: (count: number) => void;
    onGlobalShortcut: (callback: () => void) => void;
    ai?: {
      ask: (prompt: string, opts?: Record<string, unknown>) => Promise<{ text?: string; error?: string; message?: string } | string>;
      status: () => Promise<ChatrAIStatus>;
      listModels: () => Promise<{ models: { name: string; size: number }[] }>;
      retrySetup: () => Promise<{ started: boolean }>;
      onStatusChange: (callback: (data: ChatrAIStatus) => void) => void;
      offStatusChange: (callback: (data: ChatrAIStatus) => void) => void;
    };
    localFiles?: {
      ensureFolders: () => Promise<{ root: string; transcripts: string; recordings: string }>;
      saveTranscript: (payload: {
        callId?: string | null;
        meetingTitle?: string;
        participantName?: string;
        durationSeconds?: number;
        transcript: string;
        createdAt?: string;
      }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      saveSummary: (payload: {
        callId?: string | null;
        meetingTitle?: string;
        participantName?: string;
        durationSeconds?: number;
        summary: string;
        transcript?: string;
        createdAt?: string;
      }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      saveRecording: (payload: {
        callId?: string | null;
        participantName?: string;
        mimeType: string;
        data: ArrayBuffer;
        startedAt?: string;
        durationSeconds?: number;
      }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    };
    intelligence?: {
      getGoalGraph: () => Promise<any>;
      createGoal: (data: any) => Promise<any>;
      getDailyActionPlan: () => Promise<any>;
      projectFuture: (goalId: string) => Promise<any>;
      triggerDailyLoop: (type: 'morning' | 'evening') => Promise<any>;
      getExecutiveFeed: () => Promise<any>;
      triggerScenario: (scenario?: string) => Promise<boolean>;
      syncContext: () => Promise<boolean>;
    };
  };
}
