import { PresentationEventBus } from '../events/PresentationEventBus';
import { CapabilityPack, IndustryTemplate } from '../models';

export type InstallState = 'PENDING' | 'VALIDATING' | 'RESOLVING_DEPS' | 'COMPILING' | 'ACTIVATING' | 'SUCCESS' | 'ERROR';

export interface InstallStatus {
  packId: string;
  templateId?: string;
  state: InstallState;
  progress: number;
  message: string;
  logs: string[];
}

export class CapabilityRuntime {
  private activeInstalls: Map<string, InstallStatus> = new Map();

  constructor(private eventBus: PresentationEventBus) {}

  public getInstallStatus(id: string): InstallStatus | undefined {
    return this.activeInstalls.get(id);
  }

  private updateStatus(id: string, update: Partial<InstallStatus>) {
    const current = this.activeInstalls.get(id) || {
      packId: id,
      state: 'PENDING',
      progress: 0,
      message: '',
      logs: []
    };
    
    const next = { ...current, ...update };
    if (update.message) {
      next.logs = [...current.logs, update.message];
    }
    
    this.activeInstalls.set(id, next);
    
    // Broadcast live telemetry
    this.eventBus.publish({
      type: 'InstallProgressEvent',
      payload: next
    });
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async installPack(pack: CapabilityPack, templateId?: string): Promise<void> {
    const id = templateId || pack.id;

    this.updateStatus(id, { state: 'VALIDATING', progress: 10, message: `[VALIDATING] ${pack.name} integrity...` });
    await this.sleep(800);

    this.updateStatus(id, { state: 'RESOLVING_DEPS', progress: 30, message: `[RESOLVING] Checking dependencies for ${pack.name}...` });
    await this.sleep(1200);

    if (pack.dependencies && pack.dependencies.length > 0) {
      for (const dep of pack.dependencies) {
        this.updateStatus(id, { message: `[DEPENDENCY] Resolved: ${dep}` });
        await this.sleep(400);
      }
    }

    this.updateStatus(id, { state: 'COMPILING', progress: 60, message: `[COMPILING] Generating objects for ${pack.name}...` });
    await this.sleep(1500);
    this.updateStatus(id, { message: `[COMPILING] Registering workflows...` });
    await this.sleep(1000);

    this.updateStatus(id, { state: 'ACTIVATING', progress: 90, message: `[ACTIVATING] Binding capability to workspace...` });
    await this.sleep(1000);

    pack.status = 'Installed';
    
    this.updateStatus(id, { state: 'SUCCESS', progress: 100, message: `[SUCCESS] ${pack.name} installed successfully.` });
  }

  public async installTemplate(template: IndustryTemplate, targetPacks: CapabilityPack[]): Promise<void> {
    const id = template.id;
    this.updateStatus(id, { state: 'VALIDATING', progress: 5, message: `[VALIDATING] Template ${template.name}...` });
    await this.sleep(1000);
    
    this.updateStatus(id, { state: 'RESOLVING_DEPS', progress: 20, message: `[RESOLVING] Found ${targetPacks.length} capability packs in suite.` });
    await this.sleep(1500);

    for (let i = 0; i < targetPacks.length; i++) {
      const pack = targetPacks[i];
      const baseProgress = 20 + ((i / targetPacks.length) * 60);
      
      this.updateStatus(id, { state: 'COMPILING', progress: baseProgress, message: `[COMPILING] Assembling ${pack.name}...` });
      await this.sleep(1200);
      
      if (pack.dependencies && pack.dependencies.length > 0) {
        this.updateStatus(id, { message: `[DEPENDENCY] Resolving sub-graph for ${pack.name}...` });
        await this.sleep(800);
      }
      
      this.updateStatus(id, { message: `✓ ${pack.name} compiled.` });
    }

    this.updateStatus(id, { state: 'ACTIVATING', progress: 90, message: `[ACTIVATING] Provisioning suite objects...` });
    await this.sleep(2000);

    for (const pack of targetPacks) {
      pack.status = 'Installed';
    }

    this.updateStatus(id, { state: 'SUCCESS', progress: 100, message: `[SUCCESS] ${template.name} is ready.` });
  }
}
