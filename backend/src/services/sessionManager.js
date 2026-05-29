/**
 * Session Manager
 *
 * Manages per-user session state in memory.
 *
 * SCALING NOTE: In production, session state would live in Redis
 * (using ioredis or Upstash). This allows multiple Node.js instances
 * behind a load balancer to share session state — critical for
 * horizontal scaling. Socket.IO would use the Redis adapter
 * (socket.io-redis) to ensure events reach the correct instance.
 *
 * Session data includes:
 * - Full transcript buffer
 * - Rolling summary (maintained across updates)
 * - Timestamps for analytics
 * - Processing lock (prevents concurrent LLM calls for same session)
 */

export class SessionManager {
  constructor() {
    // Map<sessionId, SessionData>
    this.sessions = new Map();

    // Periodic cleanup of stale sessions (TTL: 30 minutes)
    // In production, Redis TTL handles this automatically.
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Create or retrieve a session.
   * Idempotent — safe to call multiple times with same ID.
   */
  getOrCreate(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        transcript: "",           // Full accumulated transcript
        pendingBuffer: "",         // Unprocessed text waiting for next summarization window
        summary: "",               // Latest rolling summary
        summaryHistory: [],        // Array of past summaries for history feature
        isProcessing: false,       // Lock to prevent concurrent LLM calls
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        chunkCount: 0,
        summaryCount: 0,
      });
      console.log(`[Session] Created: ${sessionId}`);
    }
    return this.sessions.get(sessionId);
  }

  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Append incoming text to both the full transcript and the
   * pending buffer. The pending buffer is what gets sent to the
   * LLM — once processed, it's cleared. The full transcript is
   * never cleared (it's the source of truth).
   */
  appendText(sessionId, text) {
    const session = this.getOrCreate(sessionId);
    session.transcript += text;
    session.pendingBuffer += text;
    session.lastActivityAt = Date.now();
    session.chunkCount++;
    return session;
  }

  /**
   * Called after a successful LLM summarization.
   * Clears the pending buffer and stores the new summary.
   */
  updateSummary(sessionId, newSummary) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.summary) {
      session.summaryHistory.push({
        text: session.summary,
        timestamp: Date.now(),
      });
      // Keep last 50 summaries for history
      if (session.summaryHistory.length > 50) {
        session.summaryHistory.shift();
      }
    }

    session.summary = newSummary;
    session.pendingBuffer = "";
    session.isProcessing = false;
    session.summaryCount++;
    return session;
  }

  /**
   * Acquire processing lock.
   * Returns false if already processing (prevents duplicate LLM calls).
   */
  acquireLock(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.isProcessing) return false;
    session.isProcessing = true;
    return true;
  }

  releaseLock(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) session.isProcessing = false;
  }

  clearSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.transcript = "";
      session.pendingBuffer = "";
      session.summary = "";
      session.summaryHistory = [];
      session.isProcessing = false;
      session.chunkCount = 0;
      session.summaryCount = 0;
      console.log(`[Session] Cleared: ${sessionId}`);
    }
    return session;
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    console.log(`[Session] Deleted: ${sessionId}`);
  }

  getStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      id: session.id,
      transcriptLength: session.transcript.length,
      chunkCount: session.chunkCount,
      summaryCount: session.summaryCount,
      duration: Math.round((Date.now() - session.createdAt) / 1000),
      summaryHistory: session.summaryHistory,
    };
  }

  getAllSessionStats() {
    const stats = [];
    for (const [id, session] of this.sessions) {
      stats.push({
        id,
        chunkCount: session.chunkCount,
        summaryCount: session.summaryCount,
        transcriptLength: session.transcript.length,
        lastActivityAt: session.lastActivityAt,
      });
    }
    return stats;
  }

  /** Remove sessions idle for more than 30 minutes */
  cleanup() {
    const TTL = 30 * 60 * 1000;
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > TTL) {
        this.deleteSession(id);
        console.log(`[Session] Cleaned up stale session: ${id}`);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}

// Singleton instance shared across the app
export const sessionManager = new SessionManager();
