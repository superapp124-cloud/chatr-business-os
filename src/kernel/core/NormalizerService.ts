import { ExecutionPlan } from './types/ABI';

export class NormalizerService {
  
  normalize(plan: ExecutionPlan, rawPayload: any): any {
    if (plan.normalizer === 'OpenMeteoNormalizer') {
      return {
        temperature: rawPayload.current_weather?.temperature,
        wind_speed: rawPayload.current_weather?.windspeed,
        unit: '°C',
        provider: 'Open-Meteo'
      };
    }
    
    // Fallback pass-through
    return rawPayload;
  }
}

export const normalizerService = new NormalizerService();
