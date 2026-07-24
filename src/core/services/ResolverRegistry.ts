import { Intent } from '../intent/types';
import { ResolvedContext } from '../capabilities/types';

export interface IContextResolver {
  name: string;
  order: number; // For sorting the pipeline (e.g. Time=10, Contact=30)
  resolve(intent: Intent, currentContext: Partial<ResolvedContext>): Promise<Partial<ResolvedContext>>;
}

export class ResolverRegistryImpl {
  private static instance: ResolverRegistryImpl;
  private resolvers: IContextResolver[] = [];

  private constructor() {}

  public static getInstance(): ResolverRegistryImpl {
    if (!ResolverRegistryImpl.instance) {
      ResolverRegistryImpl.instance = new ResolverRegistryImpl();
    }
    return ResolverRegistryImpl.instance;
  }

  public register(resolver: IContextResolver) {
    this.resolvers.push(resolver);
    this.resolvers.sort((a, b) => a.order - b.order);
    console.log(`[ResolverRegistry] Registered ${resolver.name} at order ${resolver.order}`);
  }

  public getResolvers(): IContextResolver[] {
    return this.resolvers;
  }
}

export const resolverRegistry = ResolverRegistryImpl.getInstance();
