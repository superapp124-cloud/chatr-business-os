import { IProvider, ProviderCapabilities, ProviderState, providerRegistry, ProviderRole } from './ProviderRegistry';
import { searchRuntime } from '../runtime/SearchRuntime';

export class HotelProviderStub implements IProvider {
  id = 'sys.hotel.booking.stub';
  name = 'Booking.com Hotel Provider (Production Stub)';
  type = 'hotel';
  role: ProviderRole = 'SearchProvider';

  capabilities(): ProviderCapabilities {
    return { canSearch: true, canBook: true, canCancel: true, canVerify: true };
  }

  async health(): Promise<ProviderState> {
    return { isHealthy: true, lastChecked: Date.now() };
  }

  async authenticate() { return true; }

  async search(query: any): Promise<any[]> {
    console.log(`[HotelProvider] Searching for:`, query);

    // STRICT PRODUCTION RULE: No AI generation for reality.
    // In production without an API key, return a deterministic stub that matches the Booking.com API schema.
    return [
      {
        id: 'HTL-001', name: 'The Oberoi', location: query.location || query.destination,
        checkIn: query.checkIn, checkOut: query.checkOut,
        pricePerNight: '₹12,500', rating: '4.9', stars: 5,
        amenities: ['Pool', 'Spa', 'Free WiFi', 'Breakfast'],
        _provider: this.name
      },
      {
        id: 'HTL-002', name: 'Hyatt Regency', location: query.location || query.destination,
        checkIn: query.checkIn, checkOut: query.checkOut,
        pricePerNight: '₹9,200', rating: '4.7', stars: 5,
        amenities: ['Pool', 'Gym', 'Free WiFi', 'Restaurant'],
        _provider: this.name
      },
      {
        id: 'HTL-003', name: 'Marriott', location: query.location || query.destination,
        checkIn: query.checkIn, checkOut: query.checkOut,
        pricePerNight: '₹7,800', rating: '4.5', stars: 4,
        amenities: ['Gym', 'Free WiFi', 'Bar', 'Room Service'],
        _provider: this.name
      }
    ];
  }

  async create(item: any): Promise<{ confirmationId: string; details: any }> {
    return {
      confirmationId: `HTL-${Date.now()}`,
      details: { ...item, status: 'confirmed', bookedAt: new Date().toISOString() }
    };
  }

  async cancel(bookingId: string): Promise<boolean> {
    console.log(`[HotelProvider] Cancelling booking: ${bookingId}`);
    return true;
  }

  async verify(bookingId: string): Promise<boolean> {
    return true;
  }
}

// Auto-register
export const hotelProvider = new HotelProviderStub();
providerRegistry.register(hotelProvider);
searchRuntime.registerProvider('hotel', {
  search: async (query) => {
    const results = await hotelProvider.search(query.filters);
    return { results: results.map(r => ({ ...r, title: r.name, price: r.pricePerNight })) };
  }
});
