"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitMiddleware = createRateLimitMiddleware;
const metrics_1 = require("../observability/metrics");
function createRateLimitMiddleware(env, logger) {
    const buckets = new Map();
    const windowMs = env.API_RATE_LIMIT_WINDOW_MS;
    const limitFor = (path) => /\/auth|\/login|\/session/i.test(path) ? env.AUTH_RATE_LIMIT_MAX : /\/chat|\/mentor|\/draft|\/llm|\/bare-act/i.test(path) ? env.LLM_RATE_LIMIT_MAX : env.API_RATE_LIMIT_MAX;
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets.entries())
            if (bucket.resetAt <= now)
                buckets.delete(key);
    }, Math.min(windowMs, 60000)).unref();
    return (req, res, next) => {
        if (req.method === 'OPTIONS' || req.path === '/health' || req.path === '/health/live' || req.path === '/metrics')
            return next();
        const userKey = req.user?.id || req.header('x-user-id') || req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${userKey}:${req.path.split('/').slice(0, 4).join('/')}`;
        const now = Date.now();
        const current = buckets.get(key);
        const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
        bucket.count += 1;
        buckets.set(key, bucket);
        const limit = limitFor(req.path);
        res.setHeader('RateLimit-Limit', String(limit));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > limit) {
            metrics_1.securityEvents.labels('rate_limit', 'warning').inc();
            logger.warn({ correlationId: req.correlationId, path: req.path, userKey, limit }, 'Rate limit exceeded');
            res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait before trying again.', correlationId: req.correlationId });
            return;
        }
        next();
    };
}
//# sourceMappingURL=rate-limit.middleware.js.map