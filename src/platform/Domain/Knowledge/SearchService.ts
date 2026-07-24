import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  preview: string;
  urlPath: string;
  rank: number;
}

export interface SearchResults {
  messages: SearchResult[];
  tasks: SearchResult[];
  files: SearchResult[];
  meetings: SearchResult[];
  people: SearchResult[];
  all: SearchResult[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class SearchServiceClass implements IService {
  name = 'SearchService';
  dependencies = [];

  async initialize(): Promise<void> {
    Logger.info('[SearchService] Initialized');

    // Subscribe to events to keep search index up to date
    EventBus.subscribe('MessageSent', async (event) => {
      const { message, roomId } = event.payload;
      await this.indexEntity(
        'message',
        message.id,
        `Message in room`,
        message.content?.slice(0, 200) || '',
        '', // workspaceId — we'll improve this
        `/desktop/chat?room=${roomId}`
      );
    });

    EventBus.subscribe('TaskCreated', async (event) => {
      const { task } = event.payload;
      await this.indexEntity(
        'task',
        task.id,
        task.title,
        task.description || task.title,
        task.workspaceId,
        `/desktop/workspace?task=${task.id}`
      );
    });

    EventBus.subscribe('MeetingScheduled', async (event) => {
      const { event: calEvent } = event.payload;
      await this.indexEntity(
        'meeting',
        calEvent.id,
        calEvent.title,
        calEvent.description || calEvent.title,
        calEvent.workspaceId,
        `/desktop/workspace?event=${calEvent.id}`
      );
    });
  }

  async search(
    query: string,
    workspaceId: string,
    filters?: { entityTypes?: string[] }
  ): Promise<SearchResults> {
    if (!query.trim()) {
      return { messages: [], tasks: [], files: [], meetings: [], people: [], all: [] };
    }

    try {
      // Try the Postgres FTS function first
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_workspace', {
        p_workspace_id: workspaceId,
        p_query: query.trim(),
        p_entity_types: filters?.entityTypes || null,
        p_limit: 30,
      });

      const results: SearchResult[] = (rpcError ? [] : (rpcData || [])).map((row: any) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        preview: row.preview,
        urlPath: row.url_path,
        rank: row.rank,
      }));

      // Fallback: also search tasks table directly with ilike
      if (results.filter(r => r.entityType === 'task').length === 0) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('id, title, description, workspace_id')
          .eq('workspace_id', workspaceId)
          .ilike('title', `%${query}%`)
          .limit(10);

        (taskData || []).forEach((t: any) => {
          results.push({
            entityType: 'task',
            entityId: t.id,
            title: t.title,
            preview: t.description || t.title,
            urlPath: `/desktop/workspace?task=${t.id}`,
            rank: 0.5,
          });
        });
      }

      // Kernel OS Search: Query physical filesystem via Intent Pipeline
      try {
        const { KernelClient } = await import('@/core/ipc/KernelClient');
        const kernel = KernelClient.getInstance();
        const kernelResponse = await kernel.dispatchIntent({
          intent: 'memory.search',
          context: { query: query.trim() }
        });

        if (kernelResponse.success && kernelResponse.data?.files) {
          kernelResponse.data.files.forEach((file: any) => {
            results.push({
              entityType: 'file',
              entityId: file.path,
              title: file.name,
              preview: file.contentPreview || 'Local File',
              urlPath: `/desktop/workspace?file=${encodeURIComponent(file.path)}`,
              rank: 1.0, // High rank for direct physical file matches
            });
          });
        }
      } catch (kernelErr) {
        Logger.warn('[SearchService] Kernel OS search failed', kernelErr);
      }

      const bucket = (type: string) => results.filter(r => r.entityType === type);

      return {
        messages: bucket('message'),
        tasks: bucket('task'),
        files: bucket('file'),
        meetings: bucket('meeting'),
        people: bucket('person'),
        all: results.sort((a, b) => b.rank - a.rank),
      };
    } catch (err) {
      Logger.error('[SearchService] search failed', err);
      return { messages: [], tasks: [], files: [], meetings: [], people: [], all: [] };
    }
  }

  async searchPeople(query: string): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .ilike('full_name', `%${query}%`)
        .limit(10);

      if (error) return [];

      return (data || []).map((p: any) => ({
        entityType: 'person',
        entityId: p.id,
        title: p.full_name || p.username || 'Unknown',
        preview: `@${p.username || ''}`,
        urlPath: `/desktop/contacts?user=${p.id}`,
        rank: 1,
      }));
    } catch (err) {
      Logger.error('[SearchService] searchPeople failed', err);
      return [];
    }
  }

  async indexEntity(
    entityType: string,
    entityId: string,
    title: string,
    preview: string,
    workspaceId: string,
    urlPath: string
  ): Promise<void> {
    try {
      await supabase.from('search_index').upsert(
        {
          entity_type: entityType,
          entity_id: entityId,
          title,
          preview: preview.slice(0, 500),
          workspace_id: workspaceId || null,
          url_path: urlPath,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entity_type,entity_id' }
      );
    } catch (err) {
      Logger.warn('[SearchService] indexEntity failed (non-critical)', err);
    }
  }
}

export const SearchService = new SearchServiceClass();
