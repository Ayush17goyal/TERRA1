import type { KnowledgeRetrievalResult, RetrievalCacheEntry } from '../types';

export interface RetrievalCacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  entries: number;
}

export class RetrievalCache {
  private readonly entries = new Map<string, RetrievalCacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private stats: Omit<RetrievalCacheStats, 'entries'> = { hits: 0, misses: 0, sets: 0, evictions: 0 };

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 500;
  }

  get(key: string): KnowledgeRetrievalResult | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.stats.evictions += 1;
      this.stats.misses += 1;
      return undefined;
    }

    this.stats.hits += 1;
    return entry.value;
  }

  set(key: string, value: KnowledgeRetrievalResult): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
        this.stats.evictions += 1;
      }
    }

    this.entries.set(key, { key, value, expiresAt: Date.now() + this.ttlMs });
    this.stats.sets += 1;
  }

  buildKey(parts: Record<string, unknown>): string {
    return JSON.stringify(parts, Object.keys(parts).sort());
  }

  snapshot(): RetrievalCacheStats {
    return { ...this.stats, entries: this.entries.size };
  }

  clear(): void {
    this.entries.clear();
  }
}