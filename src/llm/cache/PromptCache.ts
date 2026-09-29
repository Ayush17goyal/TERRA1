export class PromptCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 500;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    if (this.entries.size >= this.maxEntries) {
      const first = this.entries.keys().next().value;
      if (first) this.entries.delete(first);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  key(input: unknown): string {
    return stableStringify(input);
  }
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map(stableStringify).join(',')}]`;
  const object = input as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
}
