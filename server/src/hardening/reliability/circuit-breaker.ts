export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private stateValue: CircuitState = 'closed';
  constructor(private readonly name: string, private readonly failureThreshold = 5, private readonly cooldownMs = 30000) {}
  get state() {
    if (this.stateValue === 'open' && Date.now() - this.openedAt > this.cooldownMs) this.stateValue = 'half_open';
    return this.stateValue;
  }
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') throw new Error(`Circuit ${this.name} is open`);
    try { const result = await operation(); this.failures = 0; this.stateValue = 'closed'; return result; }
    catch (error) { this.failures += 1; if (this.failures >= this.failureThreshold) { this.stateValue = 'open'; this.openedAt = Date.now(); } throw error; }
  }
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); });
  try { return await Promise.race([operation, timeout]); } finally { clearTimeout(timer); }
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, attempts = 3, baseDelayMs = 250): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) { lastError = error; if (attempt === attempts) break; const jitter = Math.floor(Math.random() * baseDelayMs); await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1) + jitter)); }
  }
  throw lastError;
}