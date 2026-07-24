export interface IService {
  name: string;
  dependencies: string[];
  initialize(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: any): void;
  debug(message: string, meta?: any): void;
}

export interface IEvent<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  persistent: boolean;
}
