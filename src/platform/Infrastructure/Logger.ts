import { ILogger } from '../Shared/Types';

class LoggerService implements ILogger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }
  
  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }
  
  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error || '');
  }
  
  debug(message: string, meta?: any): void {
    // In production, this might be disabled or routed to telemetry
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}

export const Logger = new LoggerService();
