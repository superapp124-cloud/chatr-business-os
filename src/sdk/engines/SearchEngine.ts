/**
 * CHATR OS — Search Engine
 * In-memory search index per capability, merged into global search.
 */
import { ISearchConfig } from '../types';

interface SearchIndex {
  capabilityId: string;
  config: ISearchConfig;
}

const indexStore = new Map<string, SearchIndex>();

export interface ISearchResult {
  capabilityId: string;
  objectName: string;
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
}

export const SearchEngine = {
  index(capabilityId: string, config: ISearchConfig): void {
    if (!config) return;
    indexStore.set(capabilityId, { capabilityId, config });
  },

  deindex(capabilityId: string): void {
    indexStore.delete(capabilityId);
  },

  /** Search across all indexed capabilities */
  search(query: string): ISearchResult[] {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results: ISearchResult[] = [];

    for (const [capId, { config }] of indexStore.entries()) {
      for (const objConfig of config.objects) {
        // Load records from localStorage
        const storeKey = `chatr_bor_${capId}_${objConfig.object}`;
        const records: Record<string, any>[] = JSON.parse(
          localStorage.getItem(storeKey) ?? '[]'
        );

        for (const record of records) {
          const searchableText = objConfig.fields
            .map(f => String(record[f] ?? '').toLowerCase())
            .join(' ');

          if (searchableText.includes(q)) {
            results.push({
              capabilityId: capId,
              objectName: objConfig.object,
              id: record.id,
              title: String(record[objConfig.titleField] ?? 'Untitled'),
              subtitle: objConfig.subtitleField
                ? String(record[objConfig.subtitleField] ?? '')
                : undefined,
              icon: objConfig.icon,
            });
          }
        }
      }
    }

    return results.slice(0, 20);
  },
};
