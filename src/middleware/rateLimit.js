// Simple in-memory IP-based rate limiter to protect public endpoints.
// For production scale, consider Redis-backed limiters to avoid single-instance caps.
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); // 15 minutes
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 100); // max requests per window per IP

const buckets = new Map();

module.exports = function createRateLimiter() {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const key = req.ip || req.headers["x-forwarded-for"] || "global";

    const history = buckets.get(key) || [];
    const recent = history.filter((ts) => ts > windowStart);

    if (recent.length >= MAX_REQUESTS) {
      return res
        .status(429)
        .json({ error: "Too many requests, please try again later." });
    }

    recent.push(now);
    buckets.set(key, recent);
    return next();
  };
};

