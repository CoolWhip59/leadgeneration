export declare const sleep: (ms: number) => Promise<unknown>;
export declare function withRetry<T>(fn: () => Promise<T>, retries?: number, baseDelayMs?: number): Promise<T>;
export declare class SimpleRateLimiter {
    private readonly minIntervalMs;
    private lastTime;
    constructor(minIntervalMs: number);
    wait(): Promise<void>;
}
