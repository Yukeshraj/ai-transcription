/**
 * Transcription Processor
 *
 * Core pipeline that orchestrates:
 * 1. Buffered text accumulation (avoids spamming the LLM)
 * 2. Windowed summarization (every N seconds or M characters)
 * 3. Streaming results back to clients via Socket.IO
 *
 * WHY WEBSOCKETS INSTEAD OF REST:
 * REST is request-response: the client must poll to get updates,
 * introducing latency and wasted bandwidth. For real-time transcription,
 * we need the server to PUSH updates the moment they're ready.
 * WebSockets maintain a persistent TCP connection, enabling sub-100ms
 * delivery of transcript and summary updates in both directions.
 *
 * HOW BUFFERING WORKS:
 * Instead of calling the LLM on every keypress/audio chunk (which would
 * be expensive and create a thundering herd), we accumulate text for
 * SUMMARIZATION_INTERVAL_MS and only trigger if there's meaningful new
 * content (MIN_BUFFER_LENGTH chars). This balances latency vs cost.
 */

import { sessionManager } from "./sessionManager.js";

const SUMMARIZATION_INTERVAL_MS = 4000; // How often to trigger summarization
const MIN_BUFFER_LENGTH = 30;           // Minimum new chars before summarizing
const RETRY_ATTEMPTS = 3;               // LLM call retries on failure
const RETRY_DELAY_MS = 1000;            // Base delay between retries (exponential)

export class TranscriptionProcessor {
  constructor(io, aiService) {
    this.io = io;
    this.aiService = aiService;

    // Per-session summarization timers
    // Map<sessionId, NodeJS.Timer>
    this.timers = new Map();
  }

  /**
   * Handle an incoming text chunk from a client.
   * This is called on every WebSocket message.
   */
  handleChunk(socketId, sessionId, text) {
    // 1. Store in session state
    const session = sessionManager.appendText(sessionId, text);

    // 2. Echo transcript update back to THIS client immediately
    //    No LLM needed — just append to the live transcript panel
    this.io.to(socketId).emit("transcript:update", {
      text,
      fullTranscript: session.transcript,
      timestamp: Date.now(),
    });

    // 3. Ensure a summarization timer is running for this session
    this.ensureTimer(socketId, sessionId);
  }

  /**
   * Ensures a debounced summarization timer exists for a session.
   * We use a repeating interval rather than a debounce so summaries
   * arrive predictably every N seconds regardless of input rate.
   */
  ensureTimer(socketId, sessionId) {
    if (this.timers.has(sessionId)) return;

    const timer = setInterval(async () => {
      await this.triggerSummarization(socketId, sessionId);
    }, SUMMARIZATION_INTERVAL_MS);

    this.timers.set(sessionId, { timer, socketId });
  }

  /**
   * Trigger LLM summarization for a session.
   * Uses a lock to prevent concurrent calls for the same session.
   */
  async triggerSummarization(socketId, sessionId) {
    const session = sessionManager.get(sessionId);
    if (!session) return;

    // Skip if buffer too small or already processing
    if (session.pendingBuffer.length < MIN_BUFFER_LENGTH) return;
    if (!sessionManager.acquireLock(sessionId)) return;

    console.log(
      `[Processor] Summarizing session ${sessionId} ` +
      `(${session.pendingBuffer.length} new chars)`
    );

    // Notify client that summarization is starting
    this.io.to(socketId).emit("summary:start");

    let attempt = 0;
    while (attempt < RETRY_ATTEMPTS) {
      try {
        await this.streamSummaryToClient(socketId, sessionId, session);
        return; // Success — exit retry loop
      } catch (err) {
        attempt++;
        console.error(
          `[Processor] LLM error (attempt ${attempt}/${RETRY_ATTEMPTS}):`,
          err.message
        );

        if (attempt < RETRY_ATTEMPTS) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((r) =>
            setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt - 1))
          );
        } else {
          // All retries failed
          sessionManager.releaseLock(sessionId);
          this.io.to(socketId).emit("summary:error", {
            message: "AI summarization temporarily unavailable. Retrying...",
          });
        }
      }
    }
  }

  /**
   * Stream LLM response tokens back to the client in real time.
   * Each token is emitted as a separate Socket.IO event so the
   * frontend can render the "typing" effect as tokens arrive.
   */
  async streamSummaryToClient(socketId, sessionId, session) {
    let fullSummary = "";
    const capturedBuffer = session.pendingBuffer;

    for await (const token of this.aiService.streamSummary(
      capturedBuffer,
      session.summary
    )) {
      fullSummary += token;
      // Stream each token to the client
      this.io.to(socketId).emit("summary:token", { token });
    }

    // Summarization complete
    sessionManager.updateSummary(sessionId, fullSummary);

    this.io.to(socketId).emit("summary:complete", {
      summary: fullSummary,
      timestamp: Date.now(),
    });

    console.log(
      `[Processor] Summary complete for session ${sessionId}: ` +
      `"${fullSummary.slice(0, 60)}..."`
    );
  }

  /**
   * Stop processing for a session (user disconnects or stops session).
   */
  stopSession(sessionId) {
    const timerData = this.timers.get(sessionId);
    if (timerData) {
      clearInterval(timerData.timer);
      this.timers.delete(sessionId);
      console.log(`[Processor] Timer stopped for session ${sessionId}`);
    }
  }

  /**
   * Force an immediate summarization (e.g., user clicks "Stop").
   * Bypasses the timer to get a final summary before cleanup.
   */
  async forceFinalize(socketId, sessionId) {
    const session = sessionManager.get(sessionId);
    if (!session || session.pendingBuffer.length < 5) return;

    // Lower the threshold for the final call
    const originalBuffer = session.pendingBuffer;
    if (originalBuffer.length > 0) {
      await this.triggerSummarization(socketId, sessionId);
    }
  }
}
