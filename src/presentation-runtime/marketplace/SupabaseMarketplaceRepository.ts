import { supabase } from '@/integrations/supabase/client';
import { PresentationEventBus, Unsubscribe } from '../events/PresentationEventBus';
import { CapabilityCategory, CapabilityPack, Industry, IndustryTemplate } from './models';
import { MarketplaceRepository } from './MarketplaceRepository';
import { CapabilityRuntime } from './runtime/CapabilityRuntime';

type DatabaseClient = typeof supabase & { from: (table: string) => any };

export interface EnterpriseWorkspace {
  organizationId: string;
  organizationName: string;
  role: string;
  settings: Record<string, unknown>;
}

export interface EnterpriseActivity {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

const db = supabase as DatabaseClient;
const RETRY_DELAYS_MS = [0, 250, 750];

const retry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise(resolve => window.setTimeout(resolve, delay));
    try { return await operation(); } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('Enterprise service request failed.');
};

const assertResult = <T>(result: { data: T; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

const mapPack = (row: any): CapabilityPack => ({
  id: row.id, name: row.name, version: row.version, category: row.category,
  description: row.description, dependencies: row.dependencies ?? [], permissions: row.permissions ?? [],
  objects: row.objects ?? [], processes: row.processes ?? [], policies: row.policies ?? [],
  requiredPacks: row.required_packs ?? [], optionalPacks: row.optional_packs ?? [], previewImages: row.preview_images ?? [],
  author: row.author, certification: row.certification, status: row.install_status ?? 'Available', icon: row.icon ?? undefined,
});

const mapIndustry = (row: any): Industry => ({
  id: row.id, name: row.name, description: row.description, icon: row.icon,
  templates: row.template_ids ?? [], packCount: Number(row.pack_count ?? 0),
});

const mapTemplate = (row: any): IndustryTemplate => ({
  id: row.id, industryId: row.industry_id, name: row.name, description: row.description,
  packs: row.pack_ids ?? [], icon: row.icon ?? undefined,
});

export class SupabaseMarketplaceRepository implements MarketplaceRepository {
  private workspacePromise?: Promise<EnterpriseWorkspace>;
  private runtime: CapabilityRuntime;

  constructor(private eventBus: PresentationEventBus) {
    this.runtime = new CapabilityRuntime(eventBus);
  }

  private async workspace(): Promise<EnterpriseWorkspace> {
    if (!this.workspacePromise) {
      this.workspacePromise = retry(async () => {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('Sign in is required to access the Enterprise workspace.');
        const membership = assertResult(await db.from('organization_members')
          .select('organization_id, role, organizations(id, name, settings)')
          .eq('user_id', auth.user.id).limit(1).maybeSingle());
        if (!membership?.organizations) throw new Error('No Enterprise organization is assigned to this account.');
        const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
        return { organizationId: organization.id, organizationName: organization.name, role: membership.role, settings: organization.settings ?? {} };
      });
    }
    return this.workspacePromise;
  }

  async getWorkspace(): Promise<EnterpriseWorkspace> { return this.workspace(); }

  async getIndustries(): Promise<Industry[]> {
    const rows = assertResult(await retry(() => db.from('enterprise_marketplace_industries').select('*').order('name')));
    return rows.map(mapIndustry);
  }

  async getIndustryById(id: string): Promise<Industry | null> {
    const row = assertResult(await retry(() => db.from('enterprise_marketplace_industries').select('*').eq('id', id).maybeSingle()));
    return row ? mapIndustry(row) : null;
  }

  async getTemplatesByIndustry(industryId: string): Promise<IndustryTemplate[]> {
    const rows = assertResult(await retry(() => db.from('enterprise_marketplace_templates').select('*').eq('industry_id', industryId).order('name')));
    return rows.map(mapTemplate);
  }

  async getTemplateById(id: string): Promise<IndustryTemplate | null> {
    const row = assertResult(await retry(() => db.from('enterprise_marketplace_templates').select('*').eq('id', id).maybeSingle()));
    return row ? mapTemplate(row) : null;
  }

  async getCapabilityPacks(): Promise<CapabilityPack[]> {
    const workspace = await this.workspace();
    const rows = assertResult(await retry(() => db.from('enterprise_marketplace_packs')
      .select('*, enterprise_capability_installs!left(status, installed_at)')
      .eq('enterprise_capability_installs.organization_id', workspace.organizationId).order('name')));
    return rows.map((row: any) => {
      const install = Array.isArray(row.enterprise_capability_installs) ? row.enterprise_capability_installs[0] : row.enterprise_capability_installs;
      const installStatus = install?.status === 'installed' ? 'Installed' : install?.status === 'update_available' ? 'Update Available' : 'Available';
      return mapPack({ ...row, install_status: installStatus });
    });
  }

  async getCapabilityPackById(id: string): Promise<CapabilityPack | null> { return (await this.getCapabilityPacks()).find(pack => pack.id === id) ?? null; }
  async getCapabilityPacksByCategory(category: CapabilityCategory): Promise<CapabilityPack[]> { return (await this.getCapabilityPacks()).filter(pack => pack.category === category); }

  async search(query: string): Promise<{ industries: Industry[]; templates: IndustryTemplate[]; packs: CapabilityPack[] }> {
    const normalized = query.trim();
    if (!normalized) return { industries: [], templates: [], packs: [] };
    const [industries, templateRows, packs] = await Promise.all([
      this.getIndustries(),
      retry(() => db.from('enterprise_marketplace_templates').select('*').textSearch('search_vector', normalized, { type: 'websearch' })).then(assertResult),
      this.getCapabilityPacks(),
    ]);
    const fuzzy = (value: string) => value.toLocaleLowerCase().includes(normalized.toLocaleLowerCase());
    return { industries: industries.filter(item => fuzzy(item.name) || fuzzy(item.description)), templates: templateRows.map(mapTemplate), packs: packs.filter(item => fuzzy(item.name) || fuzzy(item.description) || item.category.toLocaleLowerCase().includes(normalized.toLocaleLowerCase())) };
  }

  async installPack(packId: string): Promise<void> {
    const workspace = await this.workspace();
    const pack = await this.getCapabilityPackById(packId);
    if (!pack) throw new Error('The selected capability pack no longer exists.');
    
    await this.runtime.installPack(pack);
    
    assertResult(await retry(() => db.from('enterprise_capability_installs').upsert({ organization_id: workspace.organizationId, pack_id: packId, status: 'installed', installed_at: new Date().toISOString() }, { onConflict: 'organization_id,pack_id' }).select().single()));
    await this.audit('capability.installed', 'capability_pack', packId, { name: pack.name });
    this.eventBus.publish({ type: 'CapabilityInstalled', packId });
  }

  async installTemplate(templateId: string): Promise<void> {
    const workspace = await this.workspace();
    const template = await this.getTemplateById(templateId);
    if (!template) throw new Error('The selected template no longer exists.');
    
    // In a real app we'd fetch these from the repository or DB via relations
    // For now we get them by iterating packs.
    const allPacks = await this.getCapabilityPacks();
    const targetPacks = template.packs.map(pid => allPacks.find(p => p.id === pid)).filter(Boolean) as CapabilityPack[];
    
    await this.runtime.installTemplate(template, targetPacks);
    
    for (const packId of template.packs) {
      assertResult(await retry(() => db.from('enterprise_capability_installs').upsert({ organization_id: workspace.organizationId, pack_id: packId, status: 'installed', installed_at: new Date().toISOString() }, { onConflict: 'organization_id,pack_id' }).select().single()));
      this.eventBus.publish({ type: 'CapabilityInstalled', packId });
    }
    await this.audit('capability.template_installed', 'capability_template', templateId, { name: template.name, packIds: template.packs });
  }

  async uninstallPack(packId: string): Promise<void> {
    const workspace = await this.workspace();
    assertResult(await retry(() => db.from('enterprise_capability_installs').delete().eq('organization_id', workspace.organizationId).eq('pack_id', packId)));
    await this.audit('capability.uninstalled', 'capability_pack', packId, {});
    this.eventBus.publish({ type: 'CapabilityRemoved', packId });
  }

  async updatePackConfiguration(packId: string, configuration: Record<string, unknown>): Promise<void> {
    const workspace = await this.workspace();
    assertResult(await retry(() => db.from('enterprise_capability_installs').update({ configuration, updated_at: new Date().toISOString() }).eq('organization_id', workspace.organizationId).eq('pack_id', packId)));
    await this.audit('capability.configured', 'capability_pack', packId, { configuration });
  }

  async getActivities(limit = 20): Promise<EnterpriseActivity[]> {
    const workspace = await this.workspace();
    const rows = assertResult(await retry(() => db.from('audit_logs').select('id, action, resource_type, resource_id, details, created_at').eq('organization_id', workspace.organizationId).order('created_at', { ascending: false }).limit(limit)));
    return rows.map((row: any) => ({ id: row.id, action: row.action, resourceType: row.resource_type, resourceId: row.resource_id, details: row.details ?? {}, createdAt: row.created_at }));
  }

  subscribe(onChange: () => void): Unsubscribe {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void this.workspace().then(workspace => {
      channel = supabase.channel(`enterprise-workspace:${workspace.organizationId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capability_installs', filter: `organization_id=eq.${workspace.organizationId}` }, onChange)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `organization_id=eq.${workspace.organizationId}` }, onChange).subscribe();
    });
    return () => { if (channel) void supabase.removeChannel(channel); };
  }

  private async audit(action: string, resourceType: string, resourceId: string, details: Record<string, unknown>): Promise<void> {
    const workspace = await this.workspace();
    const { data: auth } = await supabase.auth.getUser();
    assertResult(await retry(() => db.from('audit_logs').insert({ organization_id: workspace.organizationId, actor_id: auth.user?.id ?? null, action, resource_type: resourceType, resource_id: resourceId, details })));
  }
}
