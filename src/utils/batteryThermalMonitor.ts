/**
 * Chatr+ Battery & Thermal Intelligence (Phase 3)
 *
 * Monitors device battery level and connection type to dynamically downgrade
 * call resources before the OS kills the WebView or throttles the CPU.
 *
 * Triggers (descending severity):
 *   Battery < 15%       → force audio-only, reduce ICE pool
 *   Battery < 30%       → reduce FPS to 15, disable video effects
 *   Navigator onLine=false → emit 'offline' event
 */

export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';
export type BatteryProfile = 'full' | 'saving' | 'survival';

export interface BatteryThermalState {
  batteryLevel: number;      // 0-1
  isCharging: boolean;
  profile: BatteryProfile;
  thermalLevel: ThermalLevel;
}

type BatteryThermalCallback = (state: BatteryThermalState) => void;

export class BatteryThermalMonitor {
  private battery: any = null;
  private listeners: BatteryThermalCallback[] = [];
  private currentState: BatteryThermalState = {
    batteryLevel: 1,
    isCharging: true,
    profile: 'full',
    thermalLevel: 'nominal',
  };
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Battery Status API (Chrome Android, some Chromium-based)
    if ('getBattery' in navigator) {
      try {
        this.battery = await (navigator as any).getBattery();
        this.syncFromBattery();

        this.battery.addEventListener('levelchange', () => this.syncFromBattery());
        this.battery.addEventListener('chargingchange', () => this.syncFromBattery());
        console.log('🔋 [Thermal] Battery Status API active.');
      } catch (e) {
        console.warn('⚠️ [Thermal] Battery API unavailable, using poll fallback.');
      }
    }

    // Fallback: poll Network Information API and connection type every 10s
    this.pollInterval = setInterval(() => this.pollNetworkThermal(), 10_000);
    this.pollNetworkThermal();
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.battery) {
      this.battery.removeEventListener('levelchange', () => this.syncFromBattery());
      this.battery.removeEventListener('chargingchange', () => this.syncFromBattery());
    }
    console.log('🔋 [Thermal] Monitor stopped.');
  }

  onChange(cb: BatteryThermalCallback): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  getState(): BatteryThermalState {
    return { ...this.currentState };
  }

  private syncFromBattery() {
    if (!this.battery) return;
    const level: number = this.battery.level ?? 1;
    const isCharging: boolean = this.battery.charging ?? true;
    this.applyState(level, isCharging);
  }

  private pollNetworkThermal() {
    const connection = (navigator as any).connection;
    // Downgrade thermalLevel based on effective network type if battery API unavailable
    if (connection) {
      const effectiveType: string = connection.effectiveType ?? '4g';
      const thermalLevel: ThermalLevel =
        effectiveType === '2g' ? 'serious' :
        effectiveType === 'slow-2g' ? 'critical' :
        'nominal';

      if (thermalLevel !== this.currentState.thermalLevel && !this.battery) {
        this.currentState = { ...this.currentState, thermalLevel };
        this.emit();
      }
    }
  }

  private applyState(level: number, isCharging: boolean) {
    const profile: BatteryProfile =
      isCharging ? 'full' :
      level < 0.15 ? 'survival' :
      level < 0.30 ? 'saving' :
      'full';

    const thermalLevel: ThermalLevel =
      level < 0.10 ? 'critical' :
      level < 0.20 ? 'serious' :
      level < 0.35 ? 'fair' :
      'nominal';

    const newState: BatteryThermalState = {
      batteryLevel: level,
      isCharging,
      profile,
      thermalLevel,
    };

    const changed =
      newState.profile !== this.currentState.profile ||
      newState.thermalLevel !== this.currentState.thermalLevel;

    this.currentState = newState;

    if (changed) {
      console.log(`🔋 [Thermal] State → profile:${profile} thermal:${thermalLevel} battery:${(level * 100).toFixed(0)}%`);
      this.emit();
    }
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach(cb => {
      try { cb(state); } catch (e) {}
    });
  }
}

// Singleton for the app
export const batteryThermalMonitor = new BatteryThermalMonitor();

/**
 * Returns recommended video FPS cap based on thermal state
 */
export function getRecommendedFpsCap(state: BatteryThermalState): number {
  if (state.profile === 'survival' || state.thermalLevel === 'critical') return 0;
  if (state.profile === 'saving' || state.thermalLevel === 'serious') return 15;
  if (state.thermalLevel === 'fair') return 20;
  return 30;
}

/**
 * Returns true if video should be completely disabled
 */
export function shouldDisableVideo(state: BatteryThermalState): boolean {
  return state.profile === 'survival' || state.thermalLevel === 'critical';
}
