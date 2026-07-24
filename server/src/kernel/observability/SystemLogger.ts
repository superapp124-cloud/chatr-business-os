import { TraceContext } from '../../types.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  trace?: TraceContext;
  userId?: string;
  tenantId?: string;
  source?: string;
  [key: string]: any;
}

export class Logger {
  
  private static isDevelopment = process.env.NODE_ENV !== 'production';

  private static emit(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    
    if (this.isDevelopment) {
      // Pretty print for CLI / Development
      const traceId = context?.trace?.traceId ? ` [Trace: ${context.trace.traceId}]` : '';
      const source = context?.source ? `[${context.source}]` : '[System]';
      
      const formattedMessage = `${timestamp} ${level.toUpperCase()} ${source}${traceId} ${message}`;
      
      if (level === 'error') {
        console.error(formattedMessage, context?.error || '');
      } else if (level === 'warn') {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    } else {
      // Structured JSON for Datadog / ELK
      const logEntry = {
        timestamp,
        level,
        message,
        trace_id: context?.trace?.traceId,
        span_id: context?.trace?.spanId,
        user_id: context?.userId,
        tenant_id: context?.tenantId,
        source: context?.source,
        ...context
      };
      
      if (level === 'error') {
        console.error(JSON.stringify(logEntry));
      } else {
        console.log(JSON.stringify(logEntry));
      }
    }
  }

  static info(message: string, context?: LogContext) {
    this.emit('info', message, context);
  }

  static warn(message: string, context?: LogContext) {
    this.emit('warn', message, context);
  }

  static error(message: string, context?: LogContext) {
    this.emit('error', message, context);
  }

  static debug(message: string, context?: LogContext) {
    this.emit('debug', message, context);
  }
}
