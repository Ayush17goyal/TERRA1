"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
exports.withTimeout = withTimeout;
exports.retryWithBackoff = retryWithBackoff;
class CircuitBreaker {
    constructor(name, failureThreshold = 5, cooldownMs = 30000) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.cooldownMs = cooldownMs;
        this.failures = 0;
        this.openedAt = 0;
        this.stateValue = 'closed';
    }
    get state() {
        if (this.stateValue === 'open' && Date.now() - this.openedAt > this.cooldownMs)
            this.stateValue = 'half_open';
        return this.stateValue;
    }
    async execute(operation) {
        if (this.state === 'open')
            throw new Error(`Circuit ${this.name} is open`);
        try {
            const result = await operation();
            this.failures = 0;
            this.stateValue = 'closed';
            return result;
        }
        catch (error) {
            this.failures += 1;
            if (this.failures >= this.failureThreshold) {
                this.stateValue = 'open';
                this.openedAt = Date.now();
            }
            throw error;
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
async function withTimeout(operation, timeoutMs, label) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); });
    try {
        return await Promise.race([operation, timeout]);
    }
    finally {
        clearTimeout(timer);
    }
}
async function retryWithBackoff(operation, attempts = 3, baseDelayMs = 250) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === attempts)
                break;
            const jitter = Math.floor(Math.random() * baseDelayMs);
            await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1) + jitter));
        }
    }
    throw lastError;
}
//# sourceMappingURL=circuit-breaker.js.map