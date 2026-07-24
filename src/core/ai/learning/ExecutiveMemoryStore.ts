/**
 * CHATR Business OS — Enduring Executive Memory Store
 *
 * Stores and retrieves enduring working patterns learned over time:
 * - Email style preferences (Concise, Detailed)
 * - Review schedule habits (Pre-lunch proposal reviews)
 * - Channel preferences (Call after 2 unanswered emails)
 */

import { offlineDatabaseStore } from '@/core/os/storage/OfflineDatabaseStore';

export interface WorkingPattern {
  id: string;
  category: 'COMMUNICATION' | 'SCHEDULE' | 'CHANNEL' | 'DECISION';
  pattern: string;
  confidence: number; // 0.0 - 1.0
  lastObserved: string;
}

class ExecutiveMemoryStoreEngine {
  private patterns: WorkingPattern[] = [
    {
      id: 'pat_concise',
      category: 'COMMUNICATION',
      pattern: 'Prefers concise follow-up emails under 150 words',
      confidence: 0.95,
      lastObserved: new Date().toISOString(),
    },
    {
      id: 'pat_prelunch',
      category: 'SCHEDULE',
      pattern: 'Reviews high-value customer proposals before lunch',
      confidence: 0.90,
      lastObserved: new Date().toISOString(),
    },
    {
      id: 'pat_call_threshold',
      category: 'CHANNEL',
      pattern: 'Schedules phone calls after 2 unanswered email attempts',
      confidence: 0.88,
      lastObserved: new Date().toISOString(),
    },
  ];

  constructor() {
    this.loadPatterns();
  }

  private async loadPatterns() {
    try {
      const records = await offlineDatabaseStore.getAll('executive_memory');
      if (records && records.length > 0) {
        this.patterns = records;
      }
    } catch {
      // Memory fallback
    }
  }

  public getEnduringPatterns(): WorkingPattern[] {
    return this.patterns;
  }

  public async recordPattern(category: WorkingPattern['category'], pattern: string) {
    const existing = this.patterns.find((p) => p.pattern === pattern);
    if (existing) {
      existing.confidence = Math.min(1.0, existing.confidence + 0.05);
      existing.lastObserved = new Date().toISOString();
    } else {
      const newPat: WorkingPattern = {
        id: `pat_${Date.now()}`,
        category,
        pattern,
        confidence: 0.80,
        lastObserved: new Date().toISOString(),
      };
      this.patterns.push(newPat);
      try {
        await offlineDatabaseStore.save('executive_memory', newPat);
      } catch {
        // Memory fallback
      }
    }
  }
}

export const executiveMemoryStore = new ExecutiveMemoryStoreEngine();
