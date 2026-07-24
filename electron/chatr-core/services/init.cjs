'use strict';

/**
 * CHATR Kernel — Runtimes Initialization
 *
 * Instantiates the core runtimes and registers them with the RuntimeManager.
 * Each runtime owns a domain of capabilities. Providers will later be bound to these runtimes.
 */

const { runtimeManager } = require('../kernel/runtime-manager.cjs');
const {
  DesktopRuntime,
  BrowserRuntime,
  IntelligenceRuntime,
  MemoryRuntime,
  KnowledgeRuntime,
  CommunicationRuntime,
  WorkflowRuntime,
  PolicyRuntime
} = require('./interfaces.cjs');

function initializeRuntimes() {
  const desktop = new DesktopRuntime();
  runtimeManager.registerRuntime('DesktopRuntime', desktop, [
    'readFile', 'writeFile', 'launchApp', 'watchFolder', 'clipboard', 'ocr', 'notify', 'searchLocal'
  ]);

  const browser = new BrowserRuntime();
  runtimeManager.registerRuntime('BrowserRuntime', browser, [
    'browser.launch', 'browser.navigate', 'browser.execute', 'browser.download', 'browser.upload'
  ]);

  const intelligence = new IntelligenceRuntime();
  runtimeManager.registerRuntime('IntelligenceRuntime', intelligence, [
    'intelligence.ocr', 'intelligence.speechToText', 'intelligence.analyzeImage', 'intelligence.parsePDF'
  ]);

  const memory = new MemoryRuntime();
  runtimeManager.registerRuntime('MemoryRuntime', memory, [
    'memory.store', 'memory.search', 'memory.embed', 'memory.forget', 'memory.summarize'
  ]);

  const knowledge = new KnowledgeRuntime();
  runtimeManager.registerRuntime('KnowledgeRuntime', knowledge, [
    'knowledge.addNode', 'knowledge.addEdge', 'knowledge.query'
  ]);

  const communication = new CommunicationRuntime();
  runtimeManager.registerRuntime('CommunicationRuntime', communication, [
    'comm.email', 'comm.call', 'comm.sms', 'comm.meeting'
  ]);

  const workflow = new WorkflowRuntime();
  runtimeManager.registerRuntime('WorkflowRuntime', workflow, [
    'workflow.start', 'workflow.pause', 'workflow.resume', 'workflow.status'
  ]);

  const policy = new PolicyRuntime();
  runtimeManager.registerRuntime('PolicyRuntime', policy, [
    'policy.evaluate', 'policy.requestApproval', 'policy.logAudit'
  ]);

  const intent = new IntentRuntime();
  runtimeManager.registerRuntime('IntentRuntime', intent, [
    'intent.record', 'intent.timeline', 'intent.replay', 'intent.bookmark'
  ]);

  const session = new SessionRuntime();
  runtimeManager.registerRuntime('SessionRuntime', session, [
    'session.save', 'session.restore', 'session.sync'
  ]);

  return {
    desktop, browser, intelligence, memory, knowledge, communication, workflow, policy, intent, session
  };
}

module.exports = { initializeRuntimes };
