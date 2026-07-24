import { telemetry as TelemetryService } from './TelemetryService';

interface PerformanceMetrics {
  fps: number;
  memoryUsageMB?: number;
  aiLatencyMs?: number;
}

class PerformanceMonitorImpl {
  private frameCount = 0;
  private lastTime = performance.now();
  private isRunning = false;
  private aiLatencyHistory: number[] = [];
  
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.measureFPS();
    
    // Log metrics periodically
    setInterval(() => {
      this.reportMetrics();
    }, 10000); // every 10s
  }

  public stop() {
    this.isRunning = false;
  }

  public recordAILatency(latencyMs: number) {
    this.aiLatencyHistory.push(latencyMs);
    if (this.aiLatencyHistory.length > 50) {
      this.aiLatencyHistory.shift();
    }
  }

  private measureFPS = () => {
    if (!this.isRunning) return;
    
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      // Store current FPS
      (window as any).__chatr_fps = fps;
      
      this.frameCount = 0;
      this.lastTime = now;
    }
    
    requestAnimationFrame(this.measureFPS);
  }

  private reportMetrics() {
    const fps = (window as any).__chatr_fps || 60;
    let memoryUsageMB: number | undefined;
    
    // Check for performance.memory
    if ((performance as any).memory) {
      memoryUsageMB = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
    }

    let aiLatencyMs: number | undefined;
    if (this.aiLatencyHistory.length > 0) {
      aiLatencyMs = Math.round(this.aiLatencyHistory.reduce((a, b) => a + b, 0) / this.aiLatencyHistory.length);
    }

    const metrics: PerformanceMetrics = { fps, memoryUsageMB, aiLatencyMs };
    
    TelemetryService.track('performance.metrics.report', {
      ...metrics,
      timestamp: new Date().toISOString()
    });
    
    if (fps < 30) {
      console.warn(`[PerformanceMonitor] Low FPS detected: ${fps}`);
    }
  }
}

export const PerformanceMonitor = new PerformanceMonitorImpl();
