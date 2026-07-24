export interface LocationContext {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  confidence: number;
  provider: 'gps' | 'wifi' | 'calendar' | 'user' | 'fusion' | 'home' | 'work';
  timestamp: number;
  
  // Semantic Context (Higher Level)
  isHome: boolean;
  isWork: boolean;
  isTraveling: boolean;
  likelyDestination?: string;
  currentCity?: string;
  indoors?: boolean;
}

export interface LocationContextService {
  getCurrentContext(): Promise<LocationContext>;
  requestPermissions(level: 'Always' | 'While Using' | 'Only This Time'): Promise<boolean>;
}
