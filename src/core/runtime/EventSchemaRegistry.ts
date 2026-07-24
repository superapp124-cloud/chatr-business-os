/**
 * Event Schema Registry
 * Validates and versions all events flowing through the Event Runtime.
 */

export interface EventSchemaDef {
  type: string;
  version: string;
  description: string;
  persistent: boolean;
  priority: 'critical' | 'high' | 'normal' | 'background';
}

class EventSchemaRegistryImpl {
  private schemas = new Map<string, EventSchemaDef>();

  constructor() {
    this.registerSystemSchemas();
  }

  public register(schema: EventSchemaDef) {
    this.schemas.set(schema.type, schema);
  }

  public get(type: string): EventSchemaDef | undefined {
    return this.schemas.get(type);
  }

  public isPersistent(type: string): boolean {
    return this.schemas.get(type)?.persistent ?? false;
  }

  public getPriority(type: string): 'critical' | 'high' | 'normal' | 'background' {
    return this.schemas.get(type)?.priority ?? 'normal';
  }

  private registerSystemSchemas() {
    const defaultSchemas: EventSchemaDef[] = [
      { type: 'kernel.ready', version: '1.0', description: 'System booted', persistent: false, priority: 'critical' },
      { type: 'kernel.crashed', version: '1.0', description: 'System crash', persistent: true, priority: 'critical' },
      { type: 'auth.changed', version: '1.0', description: 'Auth state changed', persistent: true, priority: 'critical' },
      
      { type: 'task.created', version: '1.0', description: 'A new task was created', persistent: true, priority: 'high' },
      { type: 'chat.message.received', version: '1.0', description: 'Chat message', persistent: true, priority: 'high' },
      { type: 'workspace.changed', version: '1.0', description: 'Active workspace change', persistent: true, priority: 'high' },
      
      { type: 'search.executed', version: '1.0', description: 'Search ran', persistent: false, priority: 'normal' },
      
      { type: 'telemetry.flushed', version: '1.0', description: 'Metrics flush', persistent: false, priority: 'background' },
      
      // Benchmarks
      { type: 'benchmark.event.transient', version: '1.0', description: 'Benchmark fast event', persistent: false, priority: 'normal' },
      { type: 'benchmark.event.persistent', version: '1.0', description: 'Benchmark slow event', persistent: true, priority: 'normal' },
    ];

    defaultSchemas.forEach(s => this.register(s));
  }
}

export const eventSchemaRegistry = new EventSchemaRegistryImpl();
