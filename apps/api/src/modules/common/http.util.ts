export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 500): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

export class SimpleRateLimiter {
  private lastTime = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastTime;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastTime = Date.now();
  }
}
