import { ExecutionContext } from '@/kernel/ExecutionContext';
import { Observability } from './Observability';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  AUDIT = 4
}

export class LoggerService {
  private currentLevel = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;

  private formatMessage(level: string, message: string, context?: ExecutionContext) {
    const timestamp = new Date().toISOString();
    const correlationId = context?.correlationId || 'NO_CORRELATION';
    return `[${timestamp}] [${level}] [${correlationId}]: ${message}`;
  }

  debug(message: string, context?: ExecutionContext, meta?: any) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, context), meta || '');
    }
  }

  info(message: string, context?: ExecutionContext, meta?: any) {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, context), meta || '');
    }
  }

  warn(message: string, context?: ExecutionContext, meta?: any) {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, context), meta || '');
    }
  }

  error(message: string, error?: Error, context?: ExecutionContext) {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, context), error || '');
      Observability.recordError(message, context);
    }
  }

  audit(action: string, context: ExecutionContext, meta?: any) {
    if (this.currentLevel <= LogLevel.AUDIT) {
      // Audit logs are always printed and usually sent to a secure logging sink
      const msg = this.formatMessage('AUDIT', `ACTION: ${action}`, context);
      console.log(msg, meta || '');
      Observability.recordAudit(action, context, meta);
    }
  }
}

export const Logger = new LoggerService();
