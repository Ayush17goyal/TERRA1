export class RateLimiter {
  private readonly timestamps = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: { maxRequests?: number; windowMs?: number } = {}) {
    this.maxRequests = options.maxRequests ?? 60;
    this.windowMs = options.windowMs ?? 60000;
  }

  async acquire(key: string): Promise<void> {
    const now = Date.now();
    const existing = (this.timestamps.get(key) ?? []).filter((time) => now - time < this.windowMs);

    if (existing.length >= this.maxRequests) {
      const waitMs = this.windowMs - (now - existing[0]);
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs)));
      return this.acquire(key);
    }

    existing.push(now);
    this.timestamps.set(key, existing);
  }
}
