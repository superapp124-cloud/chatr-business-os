import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { eventBus } from '@/core/runtime/EventBus';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { ModelRouter } from '@/core/ai/runtime/ModelRouter';
import { LeadArtifact, AccountArtifact, OpportunityArtifact, ProposalArtifact } from './types';

// ─────────────────────────────────────────────────────────────
// Stage 1: Lead Qualification
// Uses: AI classify primitive
// ─────────────────────────────────────────────────────────────
const leadQualificationStage = WorkflowSDK.createStage(
  'lead_qualification',
  'Lead Qualification',
  [],
  async (ctx) => {
    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    const { provider } = await ModelRouter.route('classify', aiProviders);

    const leadText = ctx.state.leadDescription || 'Enterprise software company, 500 employees, urgent need for workflow automation.';
    const response = await provider.classify(leadText, ['QUALIFIED', 'DISQUALIFIED', 'NEEDS_MORE_INFO']);

    ctx.artifacts.lead = WorkflowSDK.createArtifact<LeadArtifact>('LeadArtifact', {
      companyName: ctx.state.companyName || 'Acme Corp',
      contactName: ctx.state.contactName || 'Jane Doe',
      contactEmail: ctx.state.contactEmail || 'jane@acme.com',
      source: ctx.state.source || 'Inbound',
      qualificationStatus: response.result.category === 'QUALIFIED' ? 'QUALIFIED' : 'DISQUALIFIED',
      score: response.result.category === 'QUALIFIED' ? 85 : 30,
      notes: response.reasoning
    }, provider.id);
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 2: Opportunity Creation (BANT Extraction)
// Uses: AI extractStructuredData primitive
// ─────────────────────────────────────────────────────────────
const opportunityCreationStage = WorkflowSDK.createStage(
  'opportunity_creation',
  'Opportunity Creation',
  ['lead_qualification'],
  async (ctx) => {
    const lead = ctx.artifacts.lead as LeadArtifact;
    if (lead.qualificationStatus === 'DISQUALIFIED') {
      throw new Error('Lead disqualified. Opportunity not created.');
    }

    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    const { provider } = await ModelRouter.route('extractStructuredData', aiProviders);

    const conversationContext = ctx.state.leadDescription || '';
    const response = await provider.extractStructuredData<any>(conversationContext, 'Opportunity');

    ctx.artifacts.opportunity = WorkflowSDK.createArtifact<OpportunityArtifact>('OpportunityArtifact', {
      accountId: lead.id,
      title: `${lead.companyName} - Enterprise Workflow Platform`,
      stage: 'DISCOVERY',
      value: response.result?.value || 450000,
      currency: 'INR',
      closeDate: '2026-10-01',
      probability: 60,
      budget: response.result?.budget || '₹5 Lakh confirmed',
      authority: response.result?.authority || 'CTO, CFO',
      need: response.result?.need || 'Workflow automation across HR, Finance, and Sales',
      timeline: response.result?.timeline || 'Q3 2026',
      nextAction: 'Send Proposal'
    }, provider.id, [lead.id]);
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 3: Proposal Generation
// Uses: AI generate primitive
// ─────────────────────────────────────────────────────────────
const proposalGenerationStage = WorkflowSDK.createStage(
  'proposal_generation',
  'Proposal Generation',
  ['opportunity_creation'],
  async (ctx) => {
    const opportunity = ctx.artifacts.opportunity as OpportunityArtifact;
    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    const { provider } = await ModelRouter.route('extractStructuredData', aiProviders);

    const proposalPrompt = `Generate a professional enterprise software proposal for ${opportunity.title}. Need: ${opportunity.need}. Budget: ${opportunity.budget}. Timeline: ${opportunity.timeline}.`;
    const response = await provider.generate(proposalPrompt);

    ctx.artifacts.proposal = WorkflowSDK.createArtifact<ProposalArtifact>('ProposalArtifact', {
      opportunityId: opportunity.id,
      title: `CHATR OS Proposal — ${opportunity.title}`,
      executiveSummary: response.result.output || 'CHATR OS is an enterprise AI workflow platform...',
      scope: ['HR Module', 'Finance Module', 'CRM Module', 'Workflow Studio'],
      pricing: [
        { item: 'CHATR OS Enterprise License', quantity: 1, unitPrice: 350000 },
        { item: 'Implementation & Onboarding', quantity: 1, unitPrice: 75000 },
        { item: 'Annual Support', quantity: 1, unitPrice: 25000 }
      ],
      totalValue: opportunity.value,
      discountPercentage: 0,
      validUntil: '2026-08-01',
      status: 'DRAFT'
    }, provider.id, [opportunity.id]);
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 4: Negotiation & Approval
// Uses: PolicyEngine via WorkflowSDK.evaluatePolicy
// ─────────────────────────────────────────────────────────────
const negotiationApprovalStage = WorkflowSDK.createStage(
  'negotiation_approval',
  'Negotiation & Approval',
  ['proposal_generation'],
  async (ctx) => {
    const proposal = ctx.artifacts.proposal as ProposalArtifact;
    const requestedDiscount = ctx.state.requestedDiscount || 0;

    if (requestedDiscount > 0) {
      const decision = await WorkflowSDK.evaluatePolicy('crm', 'discount_approval', {
        discountPercentage: requestedDiscount,
        dealValue: proposal.totalValue
      });

      ctx.state.discountDecision = decision;

      if (decision.decision === 'Reject') {
        throw new Error(`Discount rejected by policy: ${decision.reason}`);
      }

      proposal.discountPercentage = requestedDiscount;
      proposal.totalValue = proposal.totalValue * (1 - requestedDiscount / 100);
    }

    proposal.status = 'SENT';
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 5: Closed Won — Cross-Workflow Invocation
// This is the KEY PROOF of platform reuse:
// CRM triggers a Finance workflow via EventBus without direct coupling.
// ─────────────────────────────────────────────────────────────
const closedWonStage = WorkflowSDK.createStage(
  'closed_won',
  'Closed Won',
  ['negotiation_approval'],
  async (ctx) => {
    const opportunity = ctx.artifacts.opportunity as OpportunityArtifact;
    const proposal = ctx.artifacts.proposal as ProposalArtifact;

    opportunity.stage = 'CLOSED_WON';
    opportunity.probability = 100;

    // 🔑 Cross-workflow invocation via EventBus (no direct coupling)
    eventBus.publish('CRM_DEAL_CLOSED_WON', {
      opportunityId: opportunity.id,
      accountId: opportunity.accountId,
      proposalId: proposal.id,
      totalValue: proposal.totalValue,
      currency: opportunity.currency,
      // Finance workflow will pick this up and create an invoice automatically
      trigger: 'CREATE_INVOICE'
    });

    // Also emit for Timeline
    eventBus.publish('ACTIVITY_LOGGED', {
      domain: 'crm',
      event: 'DEAL_CLOSED_WON',
      entityId: opportunity.id,
      summary: `Deal closed: ${opportunity.title} — ₹${opportunity.value.toLocaleString()}`,
      timestamp: Date.now()
    });
  }
);

// ─────────────────────────────────────────────────────────────
// CRM Capability: Assembled via WorkflowSDK
// ─────────────────────────────────────────────────────────────
export const crmCapability = WorkflowSDK.createCapability(
  'crm',
  [
    leadQualificationStage,
    opportunityCreationStage,
    proposalGenerationStage,
    negotiationApprovalStage,
    closedWonStage
  ],
  (intent) => ({
    id: crypto.randomUUID(),
    type: 'crm',
    state: intent.parameters || {},
    artifacts: {},
    policies: {}
  })
);
