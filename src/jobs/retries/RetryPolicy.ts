import type { RetryPolicy } from '../types';

export const defaultRetryPolicy: RetryPolicy = {
  attempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  jitterRatio: 0.25,
};

export class RetryPolicyManager {
  nextDelay(policy: RetryPolicy, attemptsMade: number): number {
    const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attemptsMade - 1));
    const jitter = Math.floor(Math.random() * exponential * policy.jitterRatio);
    return exponential + jitter;
  }

  shouldRetry(policy: RetryPolicy, attemptsMade: number): boolean {
    return attemptsMade < policy.attempts;
  }
}
