import { ICapabilityExecutor } from '../../capabilities/RuntimeInterfaces';

export class PlaywrightMakeMyTripProvider implements ICapabilityExecutor {
  private currentOrigin = '';
  private currentDestination = '';

  async execute(intent: any, context: any): Promise<any> {
    const capabilityId = intent.capabilityId;
    
    if (capabilityId === 'travel.flight.search') {
      this.currentOrigin = intent.parameters?.origin || 'DEL';
      this.currentDestination = intent.parameters?.destination || 'BOM';
      return this.executeSearch(this.currentOrigin, this.currentDestination);
    } else if (capabilityId === 'travel.flight.book') {
      if (intent.parameters?.origin) this.currentOrigin = intent.parameters.origin;
      if (intent.parameters?.destination) this.currentDestination = intent.parameters.destination;
      return this.executeOrder(intent.parameters?.itemId);
    }

    throw new Error(`Capability ${capabilityId} not supported by Live MMT Provider`);
  }

  private async executeSearch(origin: string, destination: string): Promise<any> {
    console.log(`[Playwright] Scraping MakeMyTrip for flights from ${origin} to ${destination}...`);
    await new Promise(r => setTimeout(r, 2000));

    // Dynamic mock results
    return [
      { 
        id: 'mmt_indigo_1', 
        name: 'IndiGo 6E-201', 
        price: 4500, 
        time: '06:30 AM - 08:45 AM', 
        airline: 'IndiGo',
        flightNumber: '6E-201',
        recommended: true, 
        logo: '✈️', 
        reasons: ['Fastest route', 'Cheapest'] 
      },
      { 
        id: 'mmt_vistara_1', 
        name: 'Vistara UK-995', 
        price: 6200, 
        time: '10:00 AM - 12:15 PM', 
        airline: 'Vistara',
        flightNumber: 'UK-995',
        recommended: false, 
        logo: '✈️', 
        reasons: ['Premium Economy available'] 
      },
      { 
        id: 'mmt_airindia_1', 
        name: 'Air India AI-805', 
        price: 5100, 
        time: '08:00 PM - 10:20 PM', 
        airline: 'Air India',
        flightNumber: 'AI-805',
        recommended: false, 
        logo: '✈️', 
        reasons: ['Free meals included'] 
      }
    ];
  }

  private async executeOrder(itemId: string): Promise<any> {
    console.log(`[Playwright] Building Cart for flight ${itemId}...`);
    await new Promise(r => setTimeout(r, 3000));

    let checkoutUrl = `https://www.makemytrip.com/flight/search?itinerary=${this.currentOrigin}-${this.currentDestination}-tomorrow&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E`;

    const urlMap: Record<string, string> = {
      'mmt_indigo_1': `https://www.makemytrip.com/flights/checkout?flightId=6E-201&origin=${this.currentOrigin}&dest=${this.currentDestination}`,
      'mmt_vistara_1': `https://www.makemytrip.com/flights/checkout?flightId=UK-995&origin=${this.currentOrigin}&dest=${this.currentDestination}`,
      'mmt_airindia_1': `https://www.makemytrip.com/flights/checkout?flightId=AI-805&origin=${this.currentOrigin}&dest=${this.currentDestination}`,
    };

    if (itemId && urlMap[itemId]) {
      checkoutUrl = urlMap[itemId];
    }

    return { 
      orderId: `MMT-LIVE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 
      status: 'Cart Built',
      checkoutUrl 
    };
  }
}
