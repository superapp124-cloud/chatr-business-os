import { IService } from '../Shared/Types';
import { Logger } from './Logger';

class ServiceRegistryService {
  private services: Map<string, IService> = new Map();
  private initialized: Set<string> = new Set();

  register(service: IService): void {
    if (this.services.has(service.name)) {
      Logger.warn(`Service ${service.name} is already registered. Overwriting.`);
    }
    this.services.set(service.name, service);
    Logger.debug(`[ServiceRegistry] Registered ${service.name}`);
  }

  async initializeAll(): Promise<void> {
    const uninitialized = new Set(this.services.keys());

    const initService = async (name: string): Promise<void> => {
      if (this.initialized.has(name)) return;
      
      const service = this.services.get(name);
      if (!service) throw new Error(`Service ${name} not found in registry`);

      // Initialize dependencies first
      for (const dep of service.dependencies) {
        if (!this.initialized.has(dep)) {
          Logger.debug(`[ServiceRegistry] Initializing dependency ${dep} for ${name}`);
          await initService(dep);
        }
      }

      Logger.info(`[ServiceRegistry] Initializing ${name}...`);
      await service.initialize();
      this.initialized.add(name);
      uninitialized.delete(name);
    };

    while (uninitialized.size > 0) {
      const next = uninitialized.values().next().value;
      if (next) {
        await initService(next);
      }
    }
    
    Logger.info(`[ServiceRegistry] All services initialized successfully.`);
  }

  get<T = any>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found. Ensure it is registered.`);
    }
    return service as unknown as T;
  }

  getOptional<T = any>(name: string): T | undefined {
    const service = this.services.get(name);
    if (!service) {
      return undefined;
    }
    return service as unknown as T;
  }
}

export const ServiceRegistry = new ServiceRegistryService();
