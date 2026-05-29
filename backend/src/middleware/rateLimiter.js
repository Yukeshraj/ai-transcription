/**
 * Rate Limiting Middleware
 *
 * Protects the API and WebSocket connections from abuse.
 *
 * PRODUCTION NOTE: In a real deployment, use Redis-backed rate limiting
 * (e.g., rate-limiter-flexible with Redis store) so limits are shared
 * across all Node.js instances. In-memory limiters don't scale.
 */

import rateLimit from "express-rate-limit";

// HTTP API rate limiter — prevents REST endpoint abuse
export const httpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later.",
    retryAfter: "15 minutes",
  },
});

// WebSocket message rate limiter
// Tracks per-socket message counts in memory
export class WebSocketRateLimiter {
  constructor(options = {}) {
    this.maxMessages = options.maxMessages || 100; // Per window
    this.windowMs = options.windowMs || 10000;      // 10 seconds
    this.clients = new Map(); // Map<socketId, { count, windowStart }>
  }

  /**
   * Check if a socket is within rate limits.
   * Returns true if allowed, false if rate limited.
   */
  check(socketId) {
    const now = Date.now();
    const clientData = this.clients.get(socketId);

    if (!clientData || now - clientData.windowStart > this.windowMs) {
      // New window
      this.clients.set(socketId, { count: 1, windowStart: now });
      return true;
    }

    clientData.count++;
    if (clientData.count > this.maxMessages) {
      return false; // Rate limited
    }

    return true;
  }

  remove(socketId) {
    this.clients.delete(socketId);
  }

  // Periodic cleanup of stale entries
  startCleanup() {
    return setInterval(() => {
      const now = Date.now();
      for (const [id, data] of this.clients) {
        if (now - data.windowStart > this.windowMs * 2) {
          this.clients.delete(id);
        }
      }
    }, 30000);
  }
}
