'use strict';

/**
 * CHATR Kernel — Runtime Interfaces
 *
 * Defines the strict interfaces that all Runtimes must implement.
 * Providers implement these capabilities under the hood.
 */

class BaseRuntime {
  constructor(name) {
    this.name = name;
    this.activeProvider = null;
    this.providers = new Map();
  }

  registerProvider(name, provider, setAsActive = false) {
    this.providers.set(name, provider);
    if (setAsActive || !this.activeProvider) {
      this.activeProvider = provider;
    }
  }

  getProvider() {
    if (!this.activeProvider) {
      throw new Error(`[${this.name}] No active provider configured.`);
    }
    return this.activeProvider;
  }

  getHealth() {
    return this.activeProvider ? 'Healthy' : 'Degraded (No Active Provider)';
  }
}

class DesktopRuntime extends BaseRuntime {
  constructor() { super('DesktopRuntime'); }
  async readFile(path) { return this.getProvider().readFile(path); }
  async writeFile(path, data) { return this.getProvider().writeFile(path, data); }
  async launchApp(appId) { return this.getProvider().launchApp(appId); }
  async watchFolder(path, callback) { return this.getProvider().watchFolder(path, callback); }
  async clipboard() { return this.getProvider().clipboard(); }
  async ocr(imagePath) { return this.getProvider().ocr(imagePath); }
  async notify(title, body) { return this.getProvider().notify(title, body); }
}

class BrowserRuntime extends BaseRuntime {
  constructor() { super('BrowserRuntime'); }
  async launch(options) { return this.getProvider().launch(options); }
  async close(sessionId) { return this.getProvider().close(sessionId); }
  async navigate(sessionId, url) { return this.getProvider().navigate(sessionId, url); }
  async execute(sessionId, script) { return this.getProvider().execute(sessionId, script); }
  async download(sessionId, selector) { return this.getProvider().download(sessionId, selector); }
  async upload(sessionId, selector, filePath) { return this.getProvider().upload(sessionId, selector, filePath); }
}

class IntelligenceRuntime extends BaseRuntime {
  constructor() { super('IntelligenceRuntime'); }
  async parsePDF(path) { return this.getProvider().parsePDF(path); }
  async readWord(path) { return this.getProvider().readWord(path); }
  async transcribeSpeech(audioPath) { return this.getProvider().transcribeSpeech(audioPath); }
  async analyzeImage(imagePath) { return this.getProvider().analyzeImage(imagePath); }
}

class MemoryRuntime extends BaseRuntime {
  constructor() { super('MemoryRuntime'); }
  async store(key, data, metadata) { return this.getProvider().store(key, data, metadata); }
  async search(query, limit) { return this.getProvider().search(query, limit); }
  async embed(text) { return this.getProvider().embed(text); }
  async forget(key) { return this.getProvider().forget(key); }
  async summarize(query) { return this.getProvider().summarize(query); }
}

class KnowledgeRuntime extends BaseRuntime {
  constructor() { super('KnowledgeRuntime'); }
  async addNode(id, label, properties) { return this.getProvider().addNode(id, label, properties); }
  async addEdge(sourceId, targetId, relationship) { return this.getProvider().addEdge(sourceId, targetId, relationship); }
  async queryGraph(cypherQuery) { return this.getProvider().queryGraph(cypherQuery); }
}

class CommunicationRuntime extends BaseRuntime {
  constructor() { super('CommunicationRuntime'); }
  async email(to, subject, body) { return this.getProvider().email(to, subject, body); }
  async call(contactId) { return this.getProvider().call(contactId); }
  async sms(to, message) { return this.getProvider().sms(to, message); }
  async meeting(scheduleOptions) { return this.getProvider().meeting(scheduleOptions); }
}

class WorkflowRuntime extends BaseRuntime {
  constructor() { super('WorkflowRuntime'); }
  async start(workflowId, input) { return this.getProvider().start(workflowId, input); }
  async pause(executionId) { return this.getProvider().pause(executionId); }
  async resume(executionId) { return this.getProvider().resume(executionId); }
  async status(executionId) { return this.getProvider().status(executionId); }
}

class PolicyRuntime extends BaseRuntime {
  constructor() { super('PolicyRuntime'); }
  async evaluate(action, context) { return this.getProvider().evaluate(action, context); }
  async requestApproval(action, context) { return this.getProvider().requestApproval(action, context); }
  async logAudit(action, context, result) { return this.getProvider().logAudit(action, context, result); }
}

class IntentRuntime extends BaseRuntime {
  constructor() { super('IntentRuntime'); }
  async recordActivity(intentId, context) { return this.getProvider().recordActivity(intentId, context); }
  async getTimeline(timeRange) { return this.getProvider().getTimeline(timeRange); }
  async replayIntent(intentId) { return this.getProvider().replayIntent(intentId); }
  async bookmarkIntent(intentId, label) { return this.getProvider().bookmarkIntent(intentId, label); }
}

class SessionRuntime extends BaseRuntime {
  constructor() { super('SessionRuntime'); }
  async saveContext(workspaceId, state) { return this.getProvider().saveContext(workspaceId, state); }
  async restoreContext(workspaceId) { return this.getProvider().restoreContext(workspaceId); }
  async syncCrossDevice() { return this.getProvider().syncCrossDevice(); }
}

class ResourceRuntime extends BaseRuntime {
  constructor() { super('ResourceRuntime'); }
  async getCpuUsage() { return this.getProvider().getCpuUsage(); }
  async getMemoryUsage() { return this.getProvider().getMemoryUsage(); }
  async getGpuUsage() { return this.getProvider().getGpuUsage(); }
  async getDiskSpace() { return this.getProvider().getDiskSpace(); }
  async getBatteryState() { return this.getProvider().getBatteryState(); }
  async getNetworkStatus() { return this.getProvider().getNetworkStatus(); }
  async getThermalState() { return this.getProvider().getThermalState(); }
  async canExecuteIntensively() { return this.getProvider().canExecuteIntensively(); }
}

class DashboardRuntime extends BaseRuntime {
  constructor() { super('DashboardRuntime'); }
  async render(viewId, data) { return this.getProvider().render(viewId, data); }
}

class IdentityRuntime extends BaseRuntime {
  constructor() { super('IdentityRuntime'); }
  async authenticate(credentials) { return this.getProvider().authenticate(credentials); }
  async authorize(resource, action) { return this.getProvider().authorize(resource, action); }
}

module.exports = {
  BaseRuntime,
  DesktopRuntime,
  BrowserRuntime,
  IntelligenceRuntime,
  MemoryRuntime,
  KnowledgeRuntime,
  CommunicationRuntime,
  WorkflowRuntime,
  PolicyRuntime,
  IntentRuntime,
  SessionRuntime,
  ResourceRuntime,
  DashboardRuntime,
  IdentityRuntime
};
