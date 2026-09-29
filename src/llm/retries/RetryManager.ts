export interface RetryManagerOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

export class RetryManager {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: RetryManagerOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 8000;
  }

  async execute<T>(operation: () => Promise<T>, onRetry?: (attempt: number, error: Error) => void): Promise<{ value: T; retries: number }> {
    let attempt = 0;

    while (true) {
      try {
        return { value: await operation(), retries: attempt };
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        if (attempt >= this.maxRetries || !this.isRetryable(normalized)) {
          throw normalized;
        }

        attempt += 1;
        onRetry?.(attempt, normalized);
        await this.sleep(this.delay(attempt));
      }
    }
  }

  private isRetryable(error: Error & { status?: number }): boolean {
    if (error.name === 'AbortError') {
      return false;
    }

    if (typeof error.status === 'number') {
      return retryableStatuses.has(error.status);
    }

    return /network|fetch|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(error.message);
  }

  private delay(attempt: number): number {
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempt - 1));
    const jitter = Math.floor(Math.random() * Math.max(1, exponential * 0.25));
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
