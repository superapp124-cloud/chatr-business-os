'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ---------------------------------------------------------
// IPC Hardening: Strict whitelist prevents arbitrary calls
// ---------------------------------------------------------
const validSendChannels = [
  'process-transcript-chunk',
  'set-badge-count',
  'window:update-theme',
];

const validInvokeChannels = [
  'revoke-session',
  'get-desktop-metrics',
  'context:get-idle-time',
  'context:get-power-state',
  'context:get-clipboard-text',
  // Auto Updater
  'updater:check',
  'updater:install',
  // AI Engine (ollama.cjs)
  'ai:status',
  'ai:ask',
  'ai:list-models',
  'ai:retry-setup',
  // Legacy compat
  'ai:check-status',
  'ai:pull-model',
  // Local privacy-first call records
  'privacy:ensure-local-folders',
  'calls:save-transcript',
  'calls:save-summary',
  'calls:save-recording',
  // Agent tasks
  'agent:execute-task',
  // Browser auth handoff
  'browser:open-auth',
  'browser:open-provider-login',
  // Smart Inbox
  'smart-inbox:get-state',
  'smart-inbox:connect-provider',
  // Kernel Intent Flow (P1.1)
  'kernel:intent:submit',
  'kernel:intent:subscribe',
  'kernel:intent:select',
  'kernel:intent:auth_complete',
  'kernel:intent:pay',
  'kernel:intent:unsubscribe',
  'kernel:intent',
  'kernel:intent:process',
  'kernel:intent:resume',
  'kernel:intent:hero',
  'kernel:location:provide',
  'kernel:execution:approve',
  'kernel:execution:reject',
  // Provider Session Platform (P1.3) — status only, never credentials
  'kernel:session:check',
  'kernel:session:check_all',
  'kernel:session:revoke',
  // Universal Transaction Platform (P1.4) — ABI objects only, no credentials
  'kernel:transaction:create',
  'kernel:transaction:pay',
  'kernel:transaction:get',
  'kernel:transaction:audit',
  // Document Intelligence
  'documents:search',
  'documents:read',
  'documents:open',
  // Execution Engine v2.0
  'execution:connect-service',
  'execution:get-connected-services',
  'execution:disconnect-service',
  'execution:get-background-jobs',
  'execution:cancel-background-job',
  // Connector Marketplace
  'marketplace:get-catalog',
  'marketplace:install',
  'marketplace:remove',
  // Layer 4: Intelligence
  'intelligence:getGoalGraph',
  'intelligence:createGoal',
  'intelligence:getDailyActionPlan',
  'intelligence:projectFuture',
  'intelligence:triggerDailyLoop',
  'intelligence:getExecutiveFeed',
  'intelligence:triggerScenario',
  'intelligence:syncContext'
];

const validListenChannels = [
  'updater:status',
  'updater:progress',
  // AI Engine events (broadcast by ollama.cjs)
  'ai:status',
  // Legacy compat
  'ai:readiness-changed',
  'ai:pull-progress',
  'ai:pull-complete',
  // Meeting assistant
  'agenda-update',
  // System
  'global-shortcut',
  // Kernel Execution & Sessions
  'kernel:session:event',
  'execution:plan_started',
  'execution:node_started',
  'execution:node_awaiting_approval',
  'execution:node_completed',
  'execution:plan_completed',
  'execution:browser_step',
  'execution:capability_started',
  'execution:capability_completed',
  'background:job_completed',
  // Hero Experience — Sprint 2 streaming events
  'hero:intent.understood',
  'hero:location.resolved',
  'hero:location.missing',
  'hero:context.resolving',
  'hero:context.resolved',
  'hero:provider.discovery.started',
  'hero:provider.discovery.completed',
  'hero:decision.completed',
  'hero:checkout.ready',
  'hero:error',
  // Intelligence events
  'INTELLIGENCE.DAILY_PLAN_READY',
  'INTELLIGENCE.EVENING_REVIEW_COMPLETED',
  'INTELLIGENCE.DAILY_LOOP_STARTED'
];

contextBridge.exposeInMainWorld('electronAPI', {
  /** One-shot send (fire and forget) */
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  /** Invoke — returns a Promise */
  invoke: (channel, data) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },

  /** Subscribe to a renderer-side event */
  on: (channel, func) => {
    if (validListenChannels.includes(channel)) {
      // Strip event object to prevent prototype pollution
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  /** Remove a listener */
  off: (channel, func) => {
    if (validListenChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, func);
    }
  },

  // ── Convenience helpers ────────────────────────────────────────────────────

  /** Update taskbar / dock badge count */
  setBadgeCount: (count) => {
    ipcRenderer.send('set-badge-count', count);
  },

  /** Register global shortcut handler (Cmd+Space etc) */
  onGlobalShortcut: (callback) => {
    ipcRenderer.on('global-shortcut', () => callback());
  },

  /**
   * AI — Ask local Ollama model.
   * Returns { text } on success or { error, message } when unavailable.
   * Strict privacy mode: renderer must not fall back to cloud AI.
   */
  ai: {
    ask: (prompt, opts = {}) =>
      ipcRenderer.invoke('ai:ask', { prompt, ...opts }),

    status: () =>
      ipcRenderer.invoke('ai:status'),

    listModels: () =>
      ipcRenderer.invoke('ai:list-models'),

    retrySetup: () =>
      ipcRenderer.invoke('ai:retry-setup'),

    /** Listen for AI engine state changes (phase, progress, readyModels) */
    onStatusChange: (callback) => {
      ipcRenderer.on('ai:status', (event, data) => callback(data));
    },

    offStatusChange: (callback) => {
      ipcRenderer.removeListener('ai:status', callback);
    },
  },

  localFiles: {
    ensureFolders: () =>
      ipcRenderer.invoke('privacy:ensure-local-folders'),

    saveTranscript: (payload) =>
      ipcRenderer.invoke('calls:save-transcript', payload),

    saveSummary: (payload) =>
      ipcRenderer.invoke('calls:save-summary', payload),

    saveRecording: (payload) =>
      ipcRenderer.invoke('calls:save-recording', payload),
  },

  auth: {
    openLogin: () =>
      ipcRenderer.invoke('browser:open-auth', { mode: 'login' }),

    openSignup: () =>
      ipcRenderer.invoke('browser:open-auth', { mode: 'signup' }),

    openProviderLogin: (providerId) =>
      ipcRenderer.invoke('browser:open-provider-login', { providerId }),
  },

  smartInbox: {
    getState: () => ipcRenderer.invoke('smart-inbox:get-state'),
    connectProvider: (providerId) => ipcRenderer.invoke('smart-inbox:connect-provider', { providerId }),
  },

  documents: {
    search: (query, limit) => ipcRenderer.invoke('documents:search', { query, limit }),
    read: (filePath) => ipcRenderer.invoke('documents:read', { filePath }),
    open: (filePath) => ipcRenderer.invoke('documents:open', { filePath }),
  },

  kernel: {
    invoke: (action, request) => ipcRenderer.invoke(`kernel:${action}`, request),
  },

  intelligence: {
    getGoalGraph: () => ipcRenderer.invoke('intelligence:getGoalGraph'),
    createGoal: (data) => ipcRenderer.invoke('intelligence:createGoal', data),
    getDailyActionPlan: () => ipcRenderer.invoke('intelligence:getDailyActionPlan'),
    projectFuture: (goalId) => ipcRenderer.invoke('intelligence:projectFuture', goalId),
    triggerDailyLoop: (type) => ipcRenderer.invoke('intelligence:triggerDailyLoop', type),
    getExecutiveFeed: () => ipcRenderer.invoke('intelligence:getExecutiveFeed'),
    triggerScenario: (scenario) => ipcRenderer.invoke('intelligence:triggerScenario', scenario),
    syncContext: () => ipcRenderer.invoke('intelligence:syncContext'),
  },
});
