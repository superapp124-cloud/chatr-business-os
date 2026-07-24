import { features } from '../../config/features';
import { ServiceRegistry } from '../Infrastructure/ServiceRegistry';
import { EventBus } from '../Infrastructure/EventBus';
import { ConfigurationManager } from '../Infrastructure/Configuration';
import { OfflineManager } from '../Services/OfflineManager';
import { SyncManager } from '../Services/SyncManager';
import { NotificationManager } from '../Services/NotificationManager';
import { CollaborationBus } from '../Services/CollaborationBus';
import { HealthMonitor } from '../Services/HealthMonitor';
import { Metrics } from '../Services/Metrics';
import { AIPlatform } from '../Domain/AI/AIPlatform';
import { KnowledgeManager } from '../Services/KnowledgeManager';
import { MessagingService } from '../Domain/Communication/MessagingService';
import { TaskService } from '../Domain/Execution/TaskService';
import { CalendarService } from '../Domain/Execution/CalendarService';
import { Logger } from '../Infrastructure/Logger';
import { SearchService } from '../Domain/Knowledge/SearchService';
import { NotificationService } from '../Domain/Collaboration/NotificationService';
import { PresenceService } from '../Domain/Collaboration/PresenceService';
import { ActivityService } from '../Domain/Activity/ActivityService';

class CHATRRuntime {
  async start(): Promise<void> {
    Logger.info('[CHATR Runtime] Starting core services...');
    
    // Core Infrastructure (Always enabled)
    ServiceRegistry.register(EventBus);
    ServiceRegistry.register(ConfigurationManager);
    ServiceRegistry.register(Metrics);
    ServiceRegistry.register(HealthMonitor);
    ServiceRegistry.register(OfflineManager);
    ServiceRegistry.register(SyncManager);
    ServiceRegistry.register(NotificationManager);
    ServiceRegistry.register(ActivityService);
    ServiceRegistry.register(PresenceService);

    // Core Messaging & Calls (Enabled via features)
    if (features.messaging) {
      ServiceRegistry.register(MessagingService);
      ServiceRegistry.register(NotificationService);
    }
    
    // Optional / Experimental Features (Gated)
    if (features.ai) {
      ServiceRegistry.register(AIPlatform);
      ServiceRegistry.register(KnowledgeManager);
      ServiceRegistry.register(SearchService);
    }

    if (features.workspace) {
      ServiceRegistry.register(CollaborationBus);
      ServiceRegistry.register(TaskService);
      ServiceRegistry.register(CalendarService);
    }

    // Initialize all (ServiceRegistry handles dependency ordering)
    await ServiceRegistry.initializeAll();
    
    Logger.info('[CHATR Runtime] Platform ready.');
  }
}

export const Runtime = new CHATRRuntime();
