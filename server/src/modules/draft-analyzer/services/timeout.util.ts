/** Thrown when withTimeout fires before the wrapped promise resolves. */
export class TimeoutError extends Error {
  constructor(
    public readonly stage: string,
    public readonly limitMs: number,
  ) {
    super(`Stage "${stage}" timed out after ${limitMs} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise against a wall-clock deadline.
 * If the deadline fires first, rejects with TimeoutError.
 * The inner promise is NOT cancelled (JS has no cancellation), but the
 * caller will never see its result or error after the TimeoutError fires.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  stage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError(stage, ms)),
      ms,
    );
    promise
      .then(v  => { clearTimeout(timer); resolve(v); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}
