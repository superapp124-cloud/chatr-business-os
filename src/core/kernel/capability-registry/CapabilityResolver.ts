import { Intent } from '../intent/types';
import { triggerCabBooking } from '@/core/capabilities/travel/CabBookingWorkflow';
import { triggerCalendarMeeting } from '@/core/capabilities/calendar/CalendarMeetingWorkflow';
import { triggerFoodOrdering } from '@/core/capabilities/commerce/FoodOrderingWorkflow';
import { triggerFlightBooking } from '@/core/capabilities/travel/FlightBookingWorkflow';

export interface CapabilityResolution {
  workflowId: string;
  confidence: number;
}

export class CapabilityResolver {
  async resolve(intent: Intent, conversationId: string): Promise<CapabilityResolution | null> {
    const text = intent.rawText.toLowerCase();
    let workflowId = '';

    // 1. Cab
    if ([/book.{0,15}cab/i, /book.{0,15}ride/i, /cab.{0,15}to\b/i, /ola|uber/i].some(p => p.test(text))) {
      workflowId = await triggerCabBooking(conversationId, { rawText: text });
    }
    // 2. Calendar
    else if ([/schedule.{0,15}meeting/i, /book.{0,15}call/i, /set up.{0,15}meeting/i].some(p => p.test(text))) {
      const attendees = intent.semanticEntities['attendee'] as string || 'Team';
      workflowId = await triggerCalendarMeeting(conversationId, { rawText: text, attendees });
    }
    // 3. Food
    else if ([/hungry/i, /order.{0,15}food/i, /order.{0,15}pizza/i, /order.{0,15}biryani/i, /swiggy|zomato/i].some(p => p.test(text))) {
      let foodItem = 'food';
      const foodMap: Record<string, string> = {
        pizza: 'Pizza', burger: 'Burger', sushi: 'Sushi', biryani: 'Biryani', dosa: 'Dosa',
      };
      for (const [key, label] of Object.entries(foodMap)) {
        if (text.includes(key)) { foodItem = label; break; }
      }
      workflowId = await triggerFoodOrdering(conversationId, { rawText: text, foodItem });
    }
    // 4. Flight (Travel)
    else if ([/book.{0,20}flight/i, /flight.{0,20}tomorrow/i, /fly.{0,15}to\b/i].some(p => p.test(text))) {
      workflowId = await triggerFlightBooking(conversationId, { rawText: text });
    }
    // 5. Fallback
    else if (text.includes('order')) {
      workflowId = await triggerFoodOrdering(conversationId, { rawText: text, foodItem: 'items' });
    } else {
      return null;
    }

    return { workflowId, confidence: 1.0 };
  }
}

export const capabilityResolver = new CapabilityResolver();
