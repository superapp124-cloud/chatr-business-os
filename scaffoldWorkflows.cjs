const fs = require('fs');
const path = require('path');

const workflows = [
  { dir: 'ticketing', name: 'Ticketing', desc: 'Movies, Events, Sports, Concerts' },
  { dir: 'travel', name: 'Travel', desc: 'Flights, Hotels, Bus, Train' },
  { dir: 'home_services', name: 'HomeServices', desc: 'Cleaning, Repairs, Maintenance' },
  { dir: 'healthcare', name: 'Healthcare', desc: 'Doctors, Labs, Medicines' },
  { dir: 'logistics', name: 'Logistics', desc: 'Courier, Parcel, Tracking' },
  { dir: 'careers', name: 'Careers', desc: 'Jobs, Applications, Interviews' },
];

const basePath = 'c:/Users/Arshid.Wani/chatrchat/src/core/capabilities';

workflows.forEach(w => {
  const dirPath = path.join(basePath, w.dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const content = `import { WorkflowCapabilityContract, WorkflowManifest, WorkflowContext, buildWorkflowId } from '@/core/workflow-ui';
import { BrowserAutomationProvider } from '@/core/providers/BrowserAutomationProvider';

export class ${w.name}Workflow implements WorkflowCapabilityContract {
  readonly manifest: WorkflowManifest = {
    id: '${w.name.toUpperCase()}_WORKFLOW',
    version: '1.0',
    name: '${w.name}',
    description: '${w.desc}',
    widgets: ['progress', 'selection', 'confirmation', 'tracking', 'execution_console', 'timeline'],
    permissions: ['LOCATION', 'PAYMENTS'],
    resumable: true, timeout: 300_000, cancellable: true, supportsNestedWorkflows: false, estimatedSteps: 5,
  };

  private workflowId = '';

  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, '${w.dir}');
  }

  async execute(context: WorkflowContext): Promise<void> {
    await BrowserAutomationProvider.execute(this.workflowId, context, {
      targetDomain: '${w.name} Provider',
      expectedResultType: 'selection'
    });
  }

  async pause() {}
  async resume() {}
  async cancel() {}
  async rollback() {}
  async complete() {}
}
`;

  fs.writeFileSync(path.join(dirPath, `${w.name}Workflow.ts`), content);
});

console.log("Scaffolded all workflows.");
