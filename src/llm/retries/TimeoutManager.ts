export class TimeoutManager {
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs = 60000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  withTimeout(signal?: AbortSignal, timeoutMs = this.defaultTimeoutMs): { signal: AbortSignal; cancel: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const externalAbort = () => controller.abort();

    signal?.addEventListener('abort', externalAbort, { once: true });

    return {
      signal: controller.signal,
      cancel: () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', externalAbort);
      },
    };
  }
}

