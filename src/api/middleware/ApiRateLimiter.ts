import { ApiError } from '../errors/ApiError';

export class ApiRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: { maxRequests?: number; windowMs?: number } = {}) {
    this.maxRequests = options.maxRequests ?? 120;
    this.windowMs = options.windowMs ?? 60000;
  }

  check(key: string): void {
    const now = Date.now();
    const hits = (this.hits.get(key) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    if (hits.length >= this.maxRequests) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please retry shortly.');
    }
    hits.push(now);
    this.hits.set(key, hits);
  }
}
