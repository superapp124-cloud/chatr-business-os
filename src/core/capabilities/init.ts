import { capabilityRegistry } from './CapabilityRegistry';
import '../services/RealityEngine';    // Boot up RealityEngine
import '../services/OSSchedulerService'; // Boot up OS Scheduler (hydrates from localStorage)
import '../providers/StorageProvider'; // Register StorageProvider
import '../providers/SchedulerProvider'; // Register SchedulerProvider (legacy)
import '../providers/CalendarProvider'; // Register CalendarProvider
import '../ai/providers/OllamaProvider'; // Register OllamaProvider

import { PerformanceMonitor } from '../services/PerformanceMonitor';
import '../services/OfflineSyncPipeline'; // Instantiates singleton

import { capability as task } from './task';
import { capability as note } from './note';
import { capability as checklist } from './checklist';
import { capability as follow_up } from './follow_up';
import { capability as call } from './call';
import { capability as email } from './email';
import { capability as contact } from './contact';
import { capability as meeting } from './meeting';
import { capability as calendar_event } from './calendar_event';
import { capability as document } from './document';
import { capability as candidate_interview } from './candidate_interview';
import { capability as expense } from './expense';
import { capability as flight_booking } from './flight_booking';
import { capability as hotel_booking } from './hotel_booking';
import { capability as reminder } from './reminder';
import { capability as documents_search } from './documents_search';
import { capability as documents_read } from './documents_read';

export function initializeCapabilities() {
  capabilityRegistry.register(reminder);
  capabilityRegistry.register(task);
  capabilityRegistry.register(note);
  capabilityRegistry.register(checklist);
  capabilityRegistry.register(follow_up);
  capabilityRegistry.register(call);
  capabilityRegistry.register(email);
  capabilityRegistry.register(contact);
  capabilityRegistry.register(meeting);
  capabilityRegistry.register(calendar_event);
  capabilityRegistry.register(document);
  capabilityRegistry.register(candidate_interview);
  capabilityRegistry.register(expense);
  capabilityRegistry.register(flight_booking);
  capabilityRegistry.register(hotel_booking);
  capabilityRegistry.register(documents_search);
  capabilityRegistry.register(documents_read);

  console.log('[CapabilityRegistry] All 17 capabilities initialized.');
  console.log('[OSSchedulerService] Scheduler boot complete.');
  
  PerformanceMonitor.start();
  console.log('[PerformanceMonitor] Started tracking FPS, Memory, and Latency.');
  console.log('[OfflineSyncPipeline] Initialized queue and network listeners.');
}
