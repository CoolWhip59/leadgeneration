"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleRateLimiter = exports.sleep = void 0;
exports.withRetry = withRetry;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
async function withRetry(fn, retries = 3, baseDelayMs = 500) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        }
        catch (error) {
            attempt += 1;
            if (attempt > retries) {
                throw error;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            await (0, exports.sleep)(delay);
        }
    }
}
class SimpleRateLimiter {
    constructor(minIntervalMs) {
        this.minIntervalMs = minIntervalMs;
        this.lastTime = 0;
    }
    async wait() {
        const now = Date.now();
        const elapsed = now - this.lastTime;
        if (elapsed < this.minIntervalMs) {
            await (0, exports.sleep)(this.minIntervalMs - elapsed);
        }
        this.lastTime = Date.now();
    }
}
exports.SimpleRateLimiter = SimpleRateLimiter;
//# sourceMappingURL=http.util.js.map