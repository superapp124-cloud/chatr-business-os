export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed';

export interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  status: ExecutionStatus;
  confidence: number;
  dependencies: string[]; // array of step IDs
  estimatedCostMs: number;
  agentId: string; // The agent responsible for this step
  result?: any;
  error?: string;
  explanation?: string; // Why did the AI choose to do this?
  requiresApproval: boolean;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: ExecutionStep[];
  status: ExecutionStatus;
  createdAt: string;
  completedAt?: string;
  inputs: any;
}

export class AIExecutionEngine {
  // Mock database of playbooks and action memory
  private actionMemory: any[] = [];
  
  generatePlan(goal: string, inputs: any, agentType: string): ExecutionPlan {
    // In a real implementation, the LLM would generate this structured JSON plan.
    // We simulate the generation based on known goals.
    
    const planId = `plan_${Math.random().toString(36).substring(7)}`;
    
    if (agentType === 'recruitment' || goal.toLowerCase().includes('hire') || goal.toLowerCase().includes('java developer')) {
      return {
        id: planId,
        goal,
        inputs,
        status: 'pending',
        createdAt: new Date().toISOString(),
        steps: [
          {
            id: 'req_1',
            name: 'Create Requisition',
            description: 'Draft Job Description and Requisition for Java Developer in Bangalore',
            status: 'pending',
            confidence: 98,
            dependencies: [],
            estimatedCostMs: 1200,
            agentId: 'hiring_manager',
            requiresApproval: true,
            explanation: 'Based on the user input "Hire 5 Java Developers in Bangalore", a formal requisition is required.'
          },
          {
            id: 'src_1',
            name: 'Source Candidates',
            description: 'Search internal DB and job boards for matching candidates',
            status: 'pending',
            confidence: 92,
            dependencies: ['req_1'],
            estimatedCostMs: 3500,
            agentId: 'sourcing_agent',
            requiresApproval: false,
            explanation: 'Automatically source candidates matching the approved requisition criteria.'
          },
          {
            id: 'scr_1',
            name: 'Screen Resumes',
            description: 'Extract skills and generate scorecards for sourced candidates',
            status: 'pending',
            confidence: 95,
            dependencies: ['src_1'],
            estimatedCostMs: 4000,
            agentId: 'screening_agent',
            requiresApproval: false,
            explanation: 'Score candidates objectively before reaching out.'
          },
          {
            id: 'com_1',
            name: 'Communicate & Invite',
            description: 'Send interview invitations to top 10% scored candidates',
            status: 'pending',
            confidence: 88, // Below 95, might need approval
            dependencies: ['scr_1'],
            estimatedCostMs: 1500,
            agentId: 'communication_agent',
            requiresApproval: true, // Needs human check before sending emails
            explanation: 'Human approval required before communicating on behalf of the company.'
          },
          {
            id: 'int_1',
            name: 'Prepare Interviewers',
            description: 'Generate candidate summaries and suggested questions',
            status: 'pending',
            confidence: 99,
            dependencies: ['com_1'],
            estimatedCostMs: 1000,
            agentId: 'interview_assistant',
            requiresApproval: false,
            explanation: 'Arming interviewers with context improves hiring quality.'
          },
          {
            id: 'off_1',
            name: 'Draft Offer',
            description: 'Draft offer letter for selected candidate based on configured salary range',
            status: 'pending',
            confidence: 85,
            dependencies: ['int_1'],
            estimatedCostMs: 2000,
            agentId: 'offer_agent',
            requiresApproval: true, // Crucial
            explanation: 'Financial commitments require explicit Manager/HR approval.'
          },
          {
            id: 'onb_1',
            name: 'Onboarding Workflow',
            description: 'Trigger IT, Payroll, and documentation tasks',
            status: 'pending',
            confidence: 97,
            dependencies: ['off_1'],
            estimatedCostMs: 500,
            agentId: 'onboarding_agent',
            requiresApproval: false,
            explanation: 'Automated post-offer checklist.'
          }
        ]
      };
    }

    // Generic fallback plan
    return {
      id: planId,
      goal,
      inputs,
      status: 'pending',
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: 'gen_1',
          name: 'Analyze Request',
          description: 'Analyze the generic request',
          status: 'pending',
          confidence: 100,
          dependencies: [],
          estimatedCostMs: 500,
          agentId: 'general',
          requiresApproval: false,
          explanation: 'Initial analysis step'
        }
      ]
    };
  }

  // Orchestrator loop (simulated)
  async executePlan(plan: ExecutionPlan, onUpdate: (plan: ExecutionPlan) => void) {
    if (plan.status === 'paused' || plan.status === 'awaiting_approval') return;
    
    plan.status = 'running';
    onUpdate({ ...plan });

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      if (step.status === 'completed') continue;

      // Check dependencies
      const depsMet = step.dependencies.every(depId => 
        plan.steps.find(s => s.id === depId)?.status === 'completed'
      );

      if (!depsMet) {
        continue; // Wait
      }

      step.status = 'running';
      onUpdate({ ...plan });

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, step.estimatedCostMs));

      if (step.requiresApproval || step.confidence < 90) {
        step.status = 'awaiting_approval';
        plan.status = 'awaiting_approval';
        onUpdate({ ...plan });
        return; // Halt execution until approved
      } else {
        step.status = 'completed';
        step.result = { message: 'Auto-completed successfully.' };
        onUpdate({ ...plan });
      }
    }

    const allCompleted = plan.steps.every(s => s.status === 'completed');
    if (allCompleted) {
      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
      this.learnFromPlan(plan);
      onUpdate({ ...plan });
    }
  }

  approveStep(plan: ExecutionPlan, stepId: string, onUpdate: (plan: ExecutionPlan) => void) {
    const step = plan.steps.find(s => s.id === stepId);
    if (step && step.status === 'awaiting_approval') {
      step.status = 'completed';
      step.result = { message: 'Approved by human.' };
      plan.status = 'running'; // Resume
      onUpdate({ ...plan });
      
      // Continue execution
      this.executePlan(plan, onUpdate);
    }
  }

  rejectStep(plan: ExecutionPlan, stepId: string, onUpdate: (plan: ExecutionPlan) => void) {
    const step = plan.steps.find(s => s.id === stepId);
    if (step && step.status === 'awaiting_approval') {
      step.status = 'failed';
      step.error = 'Rejected by human.';
      plan.status = 'failed';
      onUpdate({ ...plan });
    }
  }

  private learnFromPlan(plan: ExecutionPlan) {
    // Phase 1.5 feature: Memory and pattern extraction
    this.actionMemory.push({
      goal: plan.goal,
      inputs: plan.inputs,
      timeSavedMinutes: Math.floor(Math.random() * 60) + 10,
      timestamp: new Date().toISOString()
    });
    console.log(`[AI Execution Engine] Learned from plan ${plan.id}. Enterprise memory updated.`);
  }
}

export const aiEngine = new AIExecutionEngine();
