/**
 * CHATR Business OS v1.0 - Formal Event Contracts
 * Master Event Specifications for EventBus & EventStore
 */

export interface EventMetadata {
  eventId: string;
  eventName: string;
  producer: string;
  timestamp: string;
  correlationId: string;
  organizationId: string;
  workspaceId: string;
  idempotencyKey: string;
}

export interface LeadCreatedEvent extends EventMetadata {
  eventName: 'LeadCreated';
  payload: {
    leadId: string;
    name: string;
    company: string;
    email: string;
    value: number;
    source: string;
    assignedTo?: string;
  };
}

export interface InvoicePaidEvent extends EventMetadata {
  eventName: 'InvoicePaid';
  payload: {
    invoiceId: string;
    amount: number;
    currency: string;
    paidAt: string;
    paymentMethod: string;
    customerName: string;
  };
}

export interface DocumentUploadedEvent extends EventMetadata {
  eventName: 'DocumentUploaded';
  payload: {
    documentId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    uploadedBy: string;
  };
}

export interface MeetingScheduledEvent extends EventMetadata {
  eventName: 'MeetingScheduled';
  payload: {
    meetingId: string;
    title: string;
    startTime: string;
    endTime: string;
    organizer: string;
    attendees: string[];
    location?: string;
  };
}

export interface WorkflowCompletedEvent extends EventMetadata {
  eventName: 'WorkflowCompleted';
  payload: {
    workflowId: string;
    executionId: string;
    durationMs: number;
    stepsExecuted: number;
    status: 'SUCCESS' | 'FAILED';
    errorMessage?: string;
  };
}

export type PlatformBusinessEvent =
  | LeadCreatedEvent
  | InvoicePaidEvent
  | DocumentUploadedEvent
  | MeetingScheduledEvent
  | WorkflowCompletedEvent;

export interface EventContractRegistry {
  eventName: string;
  producer: string;
  consumers: string[];
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

export const REGISTERED_EVENT_CONTRACTS: EventContractRegistry[] = [
  {
    eventName: 'LeadCreated',
    producer: 'CRMRuntime.createLead',
    consumers: ['ActivityTimeline', 'NotificationEngine', 'KnowledgeGraphIndexer', 'VectorMemoryIndexer'],
    retryPolicy: { maxRetries: 5, backoffMs: 1000 }
  },
  {
    eventName: 'InvoicePaid',
    producer: 'FinanceRuntime.payInvoice',
    consumers: ['ActivityTimeline', 'NotificationEngine', 'KnowledgeGraphIndexer', 'FinancialLedger'],
    retryPolicy: { maxRetries: 5, backoffMs: 1000 }
  },
  {
    eventName: 'DocumentUploaded',
    producer: 'DocumentUnderstanding.upload',
    consumers: ['KnowledgeGraphIndexer', 'VectorMemoryIndexer', 'OCRService'],
    retryPolicy: { maxRetries: 3, backoffMs: 500 }
  },
  {
    eventName: 'MeetingScheduled',
    producer: 'CalendarService.createEvent',
    consumers: ['ActivityTimeline', 'NotificationEngine', 'ScheduleOptimizer'],
    retryPolicy: { maxRetries: 3, backoffMs: 500 }
  },
  {
    eventName: 'WorkflowCompleted',
    producer: 'WorkEngine.executeWorkflow',
    consumers: ['ActivityTimeline', 'NotificationEngine', 'ObservabilityMonitor'],
    retryPolicy: { maxRetries: 5, backoffMs: 2000 }
  }
];
