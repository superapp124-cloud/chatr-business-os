export type PlatformSource =
  | 'mobile'
  | 'desktop'
  | 'business'
  | 'enterprise'
  | 'edge'
  | 'system';

export type PlatformActorType = 'user' | 'agent' | 'system' | 'contact';

export interface PlatformEvent<TPayload = unknown> {
  id: string;
  type: string;
  version: number;
  timestamp: string;
  workspaceId?: string;
  organizationId?: string;
  actorId?: string;
  actorType?: PlatformActorType;
  conversationId?: string;
  entityId?: string;
  entityType?: string;
  source: PlatformSource;
  correlationId?: string;
  payload: TPayload;
}

export type PlatformEventInput<TPayload = unknown> =
  Omit<PlatformEvent<TPayload>, 'id' | 'timestamp' | 'version'> &
  Partial<Pick<PlatformEvent<TPayload>, 'id' | 'timestamp' | 'version'>>;

export type PlatformEventHandler<TPayload = unknown> = (
  event: PlatformEvent<TPayload>
) => void | Promise<void>;

export interface PlatformUnsubscribe {
  unsubscribe: () => void;
}
