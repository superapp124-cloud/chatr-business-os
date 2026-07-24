import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { eventBus } from '@/core/runtime/EventBus';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { ModelRouter } from '@/core/ai/runtime/ModelRouter';
import { CompensationManager } from './CompensationManager';
import {
  FlightArtifact, HotelArtifact, TaxiArtifact,
  ItineraryArtifact, WorkflowCheckpoint, ProviderTransaction
} from './types';
import { MonetaryValue } from '../finance/types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function makeTransaction(providerId: string, ref: string): ProviderTransaction {
  return {
    providerId,
    externalReference: ref,
    status: 'CONFIRMED',
    compensationAction: 'CANCEL_BOOKING',
    retryPolicy: { maxAttempts: 3, delayMs: 1000 },
    timestamp: Date.now()
  };
}

function checkpoint(workflowId: string, label: string, completedStages: string[]): WorkflowCheckpoint {
  return {
    id: crypto.randomUUID(),
    workflowId,
    label,
    completedStages,
    snapshotTimestamp: Date.now(),
    resumable: true
  };
}

// ─────────────────────────────────────────────────────────────
// Stage 1a: Flight Search & Reserve
// ─────────────────────────────────────────────────────────────
const flightSearchStage = WorkflowSDK.createStage(
  'flight_search',
  'Flight Search & Reserve',
  [],
  async (ctx) => {
    const mgr: CompensationManager = ctx.state._compensationManager;

    const flightTx = makeTransaction('mock-flight', `FL-${Date.now()}`);

    ctx.artifacts.flight = WorkflowSDK.createArtifact<FlightArtifact>('FlightArtifact', {
      origin: ctx.state.origin || 'DEL',
      destination: ctx.state.destination || 'BOM',
      departureDate: ctx.state.departureDate || '2026-08-01',
      returnDate: ctx.state.returnDate,
      airline: 'IndiGo',
      flightNumber: '6E-201',
      seatClass: ctx.state.seatClass || 'ECONOMY',
      price: { amount: 8500, currency: 'INR', precision: 2 },
      status: 'RESERVED',
      transaction: flightTx
    }, 'mock-flight-provider');

    // Register compensation: if later stage fails, cancel this flight
    mgr.register({
      stageId: 'flight_search',
      stageName: 'Flight Search & Reserve',
      transaction: flightTx,
      compensationFn: async () => {
        ctx.artifacts.flight.status = 'CANCELLED';
        console.log(`[Compensation] Flight ${flightTx.externalReference} cancelled.`);
      }
    });

    // Checkpoint 1
    ctx.state._checkpoints = ctx.state._checkpoints || [];
    ctx.state._checkpoints.push(checkpoint(ctx.id, 'FLIGHT_RESERVED', ['flight_search']));

    eventBus.publish('TRAVEL_FLIGHT_RESERVED', {
      workflowId: ctx.id,
      flightRef: flightTx.externalReference
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 1b: Hotel Search & Reserve (PARALLEL with flight)
// ─────────────────────────────────────────────────────────────
const hotelSearchStage = WorkflowSDK.createStage(
  'hotel_search',
  'Hotel Search & Reserve',
  [],                    // ← no dependencies: runs in PARALLEL with flight_search
  async (ctx) => {
    const mgr: CompensationManager = ctx.state._compensationManager;

    const hotelTx = makeTransaction('mock-hotel', `HT-${Date.now()}`);
    const pricePerNight: MonetaryValue = { amount: 4500, currency: 'INR', precision: 2 };

    ctx.artifacts.hotel = WorkflowSDK.createArtifact<HotelArtifact>('HotelArtifact', {
      hotelName: 'Taj Lands End',
      city: ctx.state.destination || 'Mumbai',
      checkIn: ctx.state.departureDate || '2026-08-01',
      checkOut: ctx.state.returnDate || '2026-08-04',
      roomType: 'Deluxe',
      pricePerNight,
      totalPrice: { amount: pricePerNight.amount * 3, currency: 'INR', precision: 2 },
      status: 'RESERVED',
      transaction: hotelTx
    }, 'mock-hotel-provider');

    mgr.register({
      stageId: 'hotel_search',
      stageName: 'Hotel Search & Reserve',
      transaction: hotelTx,
      compensationFn: async () => {
        ctx.artifacts.hotel.status = 'CANCELLED';
        console.log(`[Compensation] Hotel ${hotelTx.externalReference} cancelled.`);
      }
    });

    ctx.state._checkpoints.push(checkpoint(ctx.id, 'HOTEL_RESERVED', ['hotel_search']));

    eventBus.publish('TRAVEL_HOTEL_RESERVED', {
      workflowId: ctx.id,
      hotelRef: hotelTx.externalReference
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 1c: Taxi Reserve (PARALLEL with flight + hotel)
// ─────────────────────────────────────────────────────────────
const taxiReserveStage = WorkflowSDK.createStage(
  'taxi_reserve',
  'Taxi Reserve',
  [],                    // ← parallel with both above
  async (ctx) => {
    const mgr: CompensationManager = ctx.state._compensationManager;

    // Simulate occasional taxi failure for compensation testing
    if (ctx.state.simulateTaxiFailure) {
      throw new Error('TaxiProvider: No cabs available for this route.');
    }

    const taxiTx = makeTransaction('mock-taxi', `TX-${Date.now()}`);

    ctx.artifacts.taxi = WorkflowSDK.createArtifact<TaxiArtifact>('TaxiArtifact', {
      pickupLocation: 'IGI Airport, Delhi',
      dropLocation: ctx.state.destination || 'Mumbai Airport',
      pickupTime: ctx.state.departureDate || '2026-08-01T06:00',
      provider: 'Ola Corporate',
      estimatedPrice: { amount: 1200, currency: 'INR', precision: 2 },
      status: 'RESERVED',
      transaction: taxiTx
    }, 'mock-taxi-provider');

    mgr.register({
      stageId: 'taxi_reserve',
      stageName: 'Taxi Reserve',
      transaction: taxiTx,
      compensationFn: async () => {
        ctx.artifacts.taxi.status = 'CANCELLED';
        console.log(`[Compensation] Taxi ${taxiTx.externalReference} cancelled.`);
      }
    });

    ctx.state._checkpoints.push(checkpoint(ctx.id, 'TAXI_RESERVED', ['taxi_reserve']));
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 2: Build Itinerary (depends on ALL three parallel stages)
// AI Runtime: summarize + reason (travel policy)
// ─────────────────────────────────────────────────────────────
const buildItineraryStage = WorkflowSDK.createStage(
  'build_itinerary',
  'Build Itinerary',
  ['flight_search', 'hotel_search', 'taxi_reserve'],  // DAG dependency
  async (ctx) => {
    const flight = ctx.artifacts.flight as FlightArtifact;
    const hotel  = ctx.artifacts.hotel  as HotelArtifact;
    const taxi   = ctx.artifacts.taxi   as TaxiArtifact | undefined;

    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    const { provider } = await ModelRouter.route('summarize', aiProviders);

    // AI: travel briefing via generic summarize()
    const tripContext = `Flight ${flight.flightNumber} (${flight.origin}→${flight.destination}), Hotel: ${hotel.hotelName} (${hotel.checkIn}-${hotel.checkOut}), Taxi: ${taxi ? taxi.provider : 'Not booked'}`;
    const summary = await provider.summarize(tripContext);

    // AI: travel policy evaluation via generic reason()
    const totalAmount = flight.price.amount + hotel.totalPrice.amount + (taxi?.estimatedPrice.amount || 0);
    const policy = await provider.reason(
      `Total trip cost: ₹${totalAmount}. Employee grade: ${ctx.state.employeeGrade || 'L4'}`,
      'Is this trip within company travel policy?'
    );

    const totalCost: MonetaryValue = { amount: totalAmount, currency: 'INR', precision: 2 };

    ctx.artifacts.itinerary = WorkflowSDK.createArtifact<ItineraryArtifact>('ItineraryArtifact', {
      travelerId: ctx.state.employeeId || 'E123',
      travelerName: ctx.state.employeeName || 'Arshid Wani',
      flightId: flight.id,
      hotelId: hotel.id,
      taxiId: taxi?.id,
      totalCost,
      summary: summary.result.summary,
      policyCompliant: policy.result.decision?.toLowerCase().includes('within') ?? true,
      checkpoints: ctx.state._checkpoints || [],
      status: 'DRAFT'
    }, provider.id, [flight.id, hotel.id, ...(taxi ? [taxi.id] : [])]);

    ctx.state._checkpoints.push(checkpoint(ctx.id, 'ITINERARY_BUILT', ['build_itinerary']));
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 3: Travel Policy Approval
// ─────────────────────────────────────────────────────────────
const travelApprovalStage = WorkflowSDK.createStage(
  'travel_approval',
  'Travel Policy Approval',
  ['build_itinerary'],
  async (ctx) => {
    const itinerary = ctx.artifacts.itinerary as ItineraryArtifact;

    const decision = await WorkflowSDK.evaluatePolicy('finance', 'expense_approval', {
      amount: itinerary.totalCost.amount,
      category: 'TRAVEL'
    });

    ctx.state.travelPolicyDecision = decision;

    if (decision.decision === 'AutoApproved') {
      itinerary.status = 'APPROVED';
    } else {
      if (!ctx.state.managerApproved) {
        ctx.state.pendingQuestion = `Travel cost ₹${itinerary.totalCost.amount.toLocaleString()} requires ${decision.decision}. Awaiting approval.`;
        throw new Error('PAUSED_FOR_APPROVAL');
      }
      itinerary.status = 'APPROVED';
    }

    ctx.state._checkpoints.push(checkpoint(ctx.id, 'TRAVEL_APPROVED', ['travel_approval']));
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 4: Cross-Domain Chain
// Travel → Expense → Calendar → Notification
// ─────────────────────────────────────────────────────────────
const crossDomainSyncStage = WorkflowSDK.createStage(
  'cross_domain_sync',
  'Cross-Domain Sync',
  ['travel_approval'],
  async (ctx) => {
    const itinerary = ctx.artifacts.itinerary as ItineraryArtifact;
    const flight    = ctx.artifacts.flight    as FlightArtifact;

    // 1. Trigger Finance Expense Workflow
    eventBus.publish('TRAVEL_APPROVED', {
      workflowId: ctx.id,
      travelerId: itinerary.travelerId,
      travelerName: itinerary.travelerName,
      totalCost: itinerary.totalCost,
      itineraryId: itinerary.id,
      trigger: 'CREATE_EXPENSE_REPORT'
    });

    // 2. Update Calendar
    eventBus.publish('CALENDAR_EVENT_REQUESTED', {
      workflowId: ctx.id,
      employeeId: itinerary.travelerId,
      title: `Business Travel: ${flight.origin} → ${flight.destination}`,
      startDate: flight.departureDate,
      endDate: flight.returnDate || flight.departureDate,
      description: itinerary.summary
    });

    // 3. Notify Traveler
    eventBus.publish('NOTIFICATION_REQUESTED', {
      recipientId: itinerary.travelerId,
      channel: 'in-app',
      title: 'Your travel is confirmed!',
      body: itinerary.summary,
      severity: 'info'
    });

    // 4. Manager Dashboard
    eventBus.publish('MANAGER_DASHBOARD_UPDATED', {
      managerId: ctx.state.managerId || 'M001',
      event: 'TRAVEL_APPROVED',
      employeeName: itinerary.travelerName,
      summary: `Travel approved: ₹${itinerary.totalCost.amount.toLocaleString()}`
    });

    itinerary.status = 'ACTIVE';
    ctx.state._checkpoints.push(checkpoint(ctx.id, 'CROSS_DOMAIN_SYNC_COMPLETE', ['cross_domain_sync']));

    eventBus.publish('ACTIVITY_LOGGED', {
      domain: 'travel',
      event: 'ITINERARY_ACTIVATED',
      entityId: itinerary.id,
      summary: `Travel booked for ${itinerary.travelerName} — ₹${itinerary.totalCost.amount.toLocaleString()}`,
      timestamp: Date.now()
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Travel Capability: Assembled via WorkflowSDK
// ─────────────────────────────────────────────────────────────
export const travelCapability = WorkflowSDK.createCapability(
  'travel',
  [
    flightSearchStage,
    hotelSearchStage,
    taxiReserveStage,
    buildItineraryStage,
    travelApprovalStage,
    crossDomainSyncStage
  ],
  (intent) => ({
    id: crypto.randomUUID(),
    type: 'travel',
    state: {
      ...intent.parameters,
      _compensationManager: new CompensationManager(crypto.randomUUID()),
      _checkpoints: []
    },
    artifacts: {},
    policies: {}
  })
);
