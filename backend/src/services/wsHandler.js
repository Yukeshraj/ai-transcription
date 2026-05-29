/**
 * WebSocket Handler
 *
 * Manages Socket.IO connection lifecycle and event routing.
 */

import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import { sessionManager } from "../services/sessionManager.js";
import { WebSocketRateLimiter } from "../middleware/rateLimiter.js";

const rateLimiter = new WebSocketRateLimiter({
  maxMessages: 200,
  windowMs: 10000,
});
rateLimiter.startCleanup();

const DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen?" + new URLSearchParams({
  model: "nova-2",
  language: "en-CA",
  punctuate: "true",
  interim_results: "true",
  endpointing: "300",
});

// Track per-socket Deepgram connections
const dgConnections = new Map();

export function setupWebSocketHandlers(io, processor) {
  io.use((socket, next) => {
    console.log(`[WS] New connection: ${socket.id}`);
    next();
  });

  io.on("connection", (socket) => {
    let sessionId = socket.handshake.query.sessionId || uuidv4();
    const session = sessionManager.getOrCreate(sessionId);

    socket.emit("session:created", {
      sessionId,
      hasExistingData: session.transcript.length > 0,
      transcript: session.transcript,
      summary: session.summary,
    });

    console.log(`[WS] Socket ${socket.id} → Session ${sessionId}`);
console.log(`[WS] Socket ${socket.id} → Session ${sessionId}`);

// TEMP DEBUG — remove after fixing
socket.onAny((event, ...args) => {
  console.log(`[WS DEBUG] Event received: ${event}`);
});
    // ─── Transcript Chunk ──────────────────────────────────────────────────
    socket.on("transcript:chunk", (data) => {
      if (!rateLimiter.check(socket.id)) {
        socket.emit("error", { code: "RATE_LIMITED", message: "Too many messages. Please slow down." });
        return;
      }
      if (!data?.text || typeof data.text !== "string") {
        socket.emit("error", { code: "INVALID_PAYLOAD", message: "Invalid chunk data" });
        return;
      }
      processor.handleChunk(socket.id, sessionId, data.text.slice(0, 500));
    });

    // ─── Session Start ─────────────────────────────────────────────────────
    socket.on("session:start", (data) => {
      if (data?.fresh) {
        sessionId = uuidv4();
        sessionManager.getOrCreate(sessionId);
        socket.emit("session:created", { sessionId, hasExistingData: false, transcript: "", summary: "" });
      }
      socket.emit("session:started", { sessionId, timestamp: Date.now() });
      console.log(`[WS] Session started: ${sessionId}`);
    });

    // ─── Session Stop ──────────────────────────────────────────────────────
    socket.on("session:stop", async () => {
      console.log(`[WS] Session stopping: ${sessionId}`);
      await processor.forceFinalize(socket.id, sessionId);
      processor.stopSession(sessionId);
      const stats = sessionManager.getStats(sessionId);
      socket.emit("session:stopped", { stats });
    });

    // ─── Session Clear ─────────────────────────────────────────────────────
    socket.on("session:clear", () => {
      processor.stopSession(sessionId);
      sessionManager.clearSession(sessionId);
      sessionId = uuidv4();
      sessionManager.getOrCreate(sessionId);
      socket.emit("session:cleared", { newSessionId: sessionId, timestamp: Date.now() });
      console.log(`[WS] Session cleared, new ID: ${sessionId}`);
    });

    // ─── Stats ─────────────────────────────────────────────────────────────
    socket.on("session:stats", () => {
      socket.emit("session:stats:response", sessionManager.getStats(sessionId));
    });

    // ─── STT: Start Deepgram ───────────────────────────────────────────────
    socket.on("stt:start", () => {
      console.log("[Deepgram] Using key:", process.env.DEEPGRAM_API_KEY?.slice(0, 8) + "...");
      if (!process.env.DEEPGRAM_API_KEY) {
        socket.emit("stt:error", { message: "Deepgram API key not configured on server" });
        return;
      }

      // Close any existing connection for this socket
      if (dgConnections.has(socket.id)) {
        dgConnections.get(socket.id).close();
        dgConnections.delete(socket.id);
      }

      const dgSocket = new WebSocket(DEEPGRAM_URL, {
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
      });

      dgConnections.set(socket.id, dgSocket);

      dgSocket.on("open", () => {
        console.log(`[Deepgram] Connected for socket ${socket.id}`);
        socket.emit("stt:ready");
      });

      dgSocket.on("message", (data) => {
        try {
          const result = JSON.parse(data.toString());
          const alt = result.channel?.alternatives?.[0];
          if (!alt?.transcript?.trim()) return;

          const transcript = alt.transcript.trim();
          if (result.is_final) {
            socket.emit("stt:final", { transcript });
          } else {
            socket.emit("stt:interim", { transcript });
          }
        } catch (err) {
          console.error("[Deepgram] Parse error:", err);
        }
      });

      dgSocket.on("error", (err) => {
        console.error(`[Deepgram] Error for socket ${socket.id}:`, err.message);
        socket.emit("stt:error", { message: "Deepgram error: " + err.message });
      });

      dgSocket.on("close", (code, reason) => {
        console.log(`[Deepgram] Closed for socket ${socket.id}: ${code}`);
        dgConnections.delete(socket.id);
        socket.emit("stt:stopped");
      });
    });

    // ─── STT: Audio chunk from browser ────────────────────────────────────
    socket.on("stt:audio", (audioChunk) => {
      const dgSocket = dgConnections.get(socket.id);
      if (dgSocket?.readyState === WebSocket.OPEN) {
        dgSocket.send(audioChunk);
      }
    });

    // ─── STT: Stop ────────────────────────────────────────────────────────
    socket.on("stt:stop", () => {
      const dgSocket = dgConnections.get(socket.id);
      if (dgSocket) {
        dgSocket.close();
        dgConnections.delete(socket.id);
        console.log(`[Deepgram] Stopped for socket ${socket.id}`);
      }
    });

    // ─── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`[WS] Disconnected: ${socket.id} (${reason})`);
      rateLimiter.remove(socket.id);
      processor.stopSession(sessionId);

      // Clean up Deepgram connection
      const dgSocket = dgConnections.get(socket.id);
      if (dgSocket) {
        dgSocket.close();
        dgConnections.delete(socket.id);
      }
    });

    // ─── Error ─────────────────────────────────────────────────────────────
    socket.on("error", (err) => {
      console.error(`[WS] Socket error for ${socket.id}:`, err);
    });
  });

  console.log("[WS] WebSocket handlers registered");
}