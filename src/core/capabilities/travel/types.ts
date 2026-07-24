/**
 * Travel Domain — Core Types
 *
 * Design principles:
 * 1. ProviderTransaction — every external call returns a structured record
 * 2. WorkflowCheckpoint — durable resume points for long-running workflows
 * 3. CompensationAction — explicit cancellation strategy per artifact
 * 4. Parallel execution — Flight/Hotel/Taxi can run simultaneously
 */

import { BaseArtifact } from '../hr/types';
import { MonetaryValue } from '../finance/types';

// ─────────────────────────────────────────────────────────────
// Provider Transaction — structured record for every booking
// ─────────────────────────────────────────────────────────────
export interface ProviderTransaction {
  providerId: string;
  externalReference: string;        // Booking ID from provider
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'COMPENSATED';
  compensationAction?: string;      // e.g. 'CANCEL_BOOKING', 'REFUND'
  retryPolicy: { maxAttempts: number; delayMs: number };
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Workflow Checkpoint — durable resume point
// ─────────────────────────────────────────────────────────────
export interface WorkflowCheckpoint {
  id: string;
  workflowId: string;
  label: string;                    // e.g. 'FLIGHT_RESERVED'
  completedStages: string[];
  snapshotTimestamp: number;
  resumable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Travel Artifacts (all immutable & versioned)
// ─────────────────────────────────────────────────────────────
export interface FlightArtifact extends BaseArtifact {
  type: 'FlightArtifact';
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  airline: string;
  flightNumber: string;
  seatClass: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  price: MonetaryValue;
  status: 'SEARCHED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED';
  transaction?: ProviderTransaction;
}

export interface HotelArtifact extends BaseArtifact {
  type: 'HotelArtifact';
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  pricePerNight: MonetaryValue;
  totalPrice: MonetaryValue;
  status: 'SEARCHED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED';
  transaction?: ProviderTransaction;
}

export interface TaxiArtifact extends BaseArtifact {
  type: 'TaxiArtifact';
  pickupLocation: string;
  dropLocation: string;
  pickupTime: string;
  provider: string;
  estimatedPrice: MonetaryValue;
  status: 'SEARCHED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED';
  transaction?: ProviderTransaction;
}

export interface ItineraryArtifact extends BaseArtifact {
  type: 'ItineraryArtifact';
  travelerId: string;
  travelerName: string;
  flightId: string;
  hotelId: string;
  taxiId?: string;
  totalCost: MonetaryValue;
  summary: string;             // AI-generated travel briefing
  policyCompliant: boolean;
  checkpoints: WorkflowCheckpoint[];
  status: 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'COMPENSATED';
}
