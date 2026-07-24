import { ResolvedIntent } from '../../types.js';

export interface IIntentResolver {
  resolve(request: string): Promise<ResolvedIntent | null>;
}

