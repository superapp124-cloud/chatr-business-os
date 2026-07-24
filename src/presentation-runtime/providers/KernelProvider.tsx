import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { EventStoreFactory } from '../../kernel/storage/EventStoreFactory';
import { ObjectRuntime } from '../../kernel/runtime/ObjectRuntime';
import { ProjectionService } from '../../kernel/projections/ProjectionService';
import { QueryEngine } from '../../kernel/query/QueryEngine';
import { CapabilityRegistry } from '../../kernel/registry/CapabilityRegistry';
import { PackLoader } from '../../kernel/registry/PackLoader';
import { SyncState, SyncStatus, CommandResult, ErrorCode } from '../contracts/UIContracts';
import { PresentationEventBus, PresentationEvent } from '../events/PresentationEventBus';
import { TelemetrySink, InMemoryTelemetrySink, TelemetryEvent } from '../telemetry/TelemetrySink';
import { initKnowledgeGraphConsumer } from '../../core/knowledge/KnowledgeGraphConsumer';

import recruitmentManifest from '../../capability-packs/recruitment/manifest.json';
import candidateEdl from '../../capability-packs/recruitment/objects/Candidate.edl.json';

import executiveManifest from '../../capability-packs/executive/manifest.json';
import decisionEdl from '../../capability-packs/executive/objects/Decision.edl.json';

import { SyncEngine } from '../sync/SyncEngine';
import { CommandQueue } from '../sync/CommandQueue';
import { HttpTransport } from '../sync/HttpTransport';
import { SyncSession, INITIAL_SYNC_SESSION } from '../sync/SyncSession';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { MarketplaceRepository } from '../marketplace/MarketplaceRepository';
import { SupabaseMarketplaceRepository } from '../marketplace/SupabaseMarketplaceRepository';

interface KernelContextValue {
 objectRuntime: ObjectRuntime;
 queryEngine: QueryEngine;
 projectionService: ProjectionService;
 registry: CapabilityRegistry;
 syncStatus: SyncStatus;
 syncSession: SyncSession;
 eventBus: PresentationEventBus;
 telemetrySink: TelemetrySink;
 syncEngine: SyncEngine;
 marketplaceRepository: MarketplaceRepository;
}

export const KernelContext = createContext<KernelContextValue | null>(null);

export const KernelProvider: React.FC<{ children: React.ReactNode; useInMemory?: boolean }> = ({ children, useInMemory }) => {
 const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
 const [syncSession, setSyncSession] = useState<SyncSession>({ ...INITIAL_SYNC_SESSION });

 const kernel = useMemo(() => {
 // 1. Dependency Injection
 const eventStore = useInMemory ? EventStoreFactory.create() : new IndexedDBEventStore();
 
 // 2. Initialize the Presentation Abstractions
 const eventBus = new PresentationEventBus();
 const telemetrySink = new InMemoryTelemetrySink();
 
 // 3. Initialize Sync Architecture
 const commandQueue = new CommandQueue();
 // Use a dummy local URL for testing, or environment variable in production
 const transport = new HttpTransport('http://localhost:8080');
 const syncEngine = new SyncEngine(transport, commandQueue, eventStore, eventBus, telemetrySink);

 // 4. Initialize the immutable Kernel architecture
 const registry = new CapabilityRegistry();
 const packLoader = new PackLoader(registry);

 // Boot capability packs dynamically
 packLoader.loadFromJSON(recruitmentManifest, [candidateEdl]).then(() => {
 eventBus.publish({ type: 'CapabilityInstalled', packId: 'recruitment' });
 }).catch(console.error);
 
 packLoader.loadFromJSON(executiveManifest, [decisionEdl]).then(() => {
 eventBus.publish({ type: 'CapabilityInstalled', packId: 'executive' });
 }).catch(console.error);

 const runtime = new ObjectRuntime(eventStore, registry);
 const projectionService = new ProjectionService(eventStore);
 const query = new QueryEngine(projectionService);

 // 5. Initialize the tenant-scoped Marketplace repository.
 const marketplaceRepository = new SupabaseMarketplaceRepository(eventBus);

 // 6. Start services
 projectionService.start();
 syncEngine.start(5000);

 // 7. Boot OS-level EventBus consumers
 initKnowledgeGraphConsumer();

 return {
 objectRuntime: runtime,
 queryEngine: query,
 projectionService,
 registry,
 eventBus,
 telemetrySink,
 syncEngine,
 marketplaceRepository
 };
 }, [useInMemory]);

 useEffect(() => {
 return kernel.projectionService.onStateChange(state => {
 const status: SyncStatus = { state };
 setSyncStatus(status);
 kernel.eventBus.publish({ type: 'SyncStateChanged', status });
 });
 }, [kernel]);

 useEffect(() => {
 kernel.syncEngine.onStateChange(session => {
 setSyncSession(session);
 kernel.eventBus.publish({ type: 'SyncSessionChanged', session });
 });
 return () => kernel.syncEngine.stop();
 }, [kernel]);

 const value = useMemo(() => ({ ...kernel, syncStatus, syncSession }), [kernel, syncStatus, syncSession]);

 return (
 <KernelContext.Provider value={value}>
 {children}
 </KernelContext.Provider>
 );
};

export * from '../hooks';
