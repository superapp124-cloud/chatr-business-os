import { LocalDB } from '../db/LocalDB';
import { Capacitor } from '@capacitor/core';
import '../../types/plugins';

export interface UnifiedSearchResult {
  id: string;
  source: 'mail' | 'sms' | 'call';
  title: string; // e.g. Sender Name
  subtitle: string; // e.g. Subject or first line
  timestamp: number;
}

export class SearchEngine {
  /**
   * Queries the local database and native SMS logs simultaneously.
   * Merges and sorts the results chronologically.
   */
  static async query(term: string): Promise<UnifiedSearchResult[]> {
    if (!term || term.trim().length < 2) {
      return [];
    }

    try {
      // 1. Dispatch intent to the real Node.js Kernel
      const { kernelClient } = await import('../ipc/KernelClient');
      const response = await kernelClient.dispatchIntent({
        intent: 'memory.search',
        context: { query: term }
      });

      if (!response.success) {
        console.warn('[SearchEngine] Kernel search failed:', response.error);
        return [];
      }

      // 2. The Kernel's LocalSearchProvider returns raw files, map them to UI
      const files = response.data?.files || [];
      const results: UnifiedSearchResult[] = files.map((file: any) => ({
        id: file.path,
        source: 'mail', // Mapped to 'mail' temporarily for UI icon purposes
        title: file.name,
        subtitle: file.contentPreview || 'Local File',
        timestamp: new Date(file.timestamp).getTime() || Date.now()
      }));

      return results;
    } catch (e) {
      console.warn('[SearchEngine] Failed to dispatch search intent', e);
      return [];
    }
  }
}
