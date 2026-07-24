import { emitWorkflowUIEvent } from '../../workflow-ui/WorkflowUIRuntime';
import { documentEngine } from '../../document/DocumentEngine';
import { documentCapabilityRouter } from '../../document/DocumentCapabilityRouter';
import type { WorkflowManifest } from '../../workflow-ui';

const MANIFEST: WorkflowManifest = {
  id: 'DOCUMENT_UNDERSTANDING',
  version: '1.0',
  name: 'Document Analysis',
  description: 'Analyzes documents and routes to capabilities',
  widgets: ['extraction_progress'],
  permissions: [],
  resumable: false,
  timeout: 300000,
  cancellable: true,
  supportsNestedWorkflows: true
};

export class DocumentUnderstandingWorkflow {
  private workflowId: string;

  constructor(workflowId: string) {
    this.workflowId = workflowId;
  }

  async run(files: File[], intent: string): Promise<void> {
    try {
      // 1. Create the Extraction Progress Widget
      emitWorkflowUIEvent({
        event: 'WIDGET_CREATED',
        widgetId: `doc-extraction-${this.workflowId}`,
        workflowId: this.workflowId,
        widgetType: 'extraction_progress',
        widgetVersion: '1.0',
        lifecycle: 'ACTIVE',
        payload: {
          stage: 'initializing',
          fileCount: files.length
        }
      });

      // 2. Process all documents through the Engine
      const unifiedDocs = [];
      for (const file of files) {
        const doc = await documentEngine.processFile(file, this.workflowId);
        unifiedDocs.push(doc);
      }

      // Mark extraction complete
      emitWorkflowUIEvent({
        event: 'WIDGET_LIFECYCLE',
        widgetId: `doc-extraction-${this.workflowId}`,
        workflowId: this.workflowId,
        widgetType: 'extraction_progress',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED'
      });

      // 3. Route to Capability
      const insight = await documentCapabilityRouter.route(unifiedDocs, intent);

      // 4. Render Capability Result
      for (const widgetType of insight.widgets) {
        emitWorkflowUIEvent({
          event: 'WIDGET_CREATED',
          widgetId: `doc-result-${Date.now()}-${Math.random()}`,
          workflowId: this.workflowId,
          widgetType,
          widgetVersion: '1.0',
          lifecycle: 'ACTIVE',
          payload: { insight }
        });
      }

    } catch (e: any) {
      console.error('[DocumentUnderstandingWorkflow] Failed', e);
      // Could render an error widget here
    }
  }
}

export function triggerDocumentUnderstanding(files: File[], intent: string) {
  const workflowId = `doc-understand-${Date.now()}`;
  emitWorkflowUIEvent({
    event: 'WORKFLOW_STARTED',
    workflowId,
    payload: { manifest: MANIFEST }
  });
  
  const workflow = new DocumentUnderstandingWorkflow(workflowId);
  workflow.run(files, intent).then(() => {
    emitWorkflowUIEvent({
      event: 'WORKFLOW_COMPLETED',
      workflowId
    });
  });

  return workflowId;
}
