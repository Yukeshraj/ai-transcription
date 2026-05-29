/**
 * WebSocket Service
 *
 * Encapsulates all Socket.IO client logic.
 * The UI components never touch the socket directly — they go through
 * this service. This means we can swap Socket.IO for native WebSockets
 * or SSE without touching any UI component.
 *
 * RECONNECTION STRATEGY:
 * Socket.IO handles reconnection automatically with exponential backoff.
 * We also handle the "session:created" event on reconnect to restore
 * the user's transcript and summary seamlessly.
 */

import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

class TranscriptionSocketService {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.listeners = new Map();
    this.connectionState = "disconnected";
  }

  /**
   * Connect to the WebSocket server.
   * @param {string|null} existingSessionId - Pass to restore a session
   */
  connect(existingSessionId = null) {
    if (this.socket?.connected) return;

    this.sessionId = existingSessionId;

    this.socket = io(BACKEND_URL, {
      // Prefer WebSocket, fall back to polling for restricted networks
      transports: ["websocket", "polling"],
      // Session ID sent in handshake for immediate session restoration
      query: existingSessionId ? { sessionId: existingSessionId } : {},
      // Reconnection config
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 10000,
    });

    this.registerCoreHandlers();
  }

  /** Core lifecycle handlers — always registered regardless of UI */
  registerCoreHandlers() {
    this.socket.on("connect", () => {
      this.connectionState = "connected";
      console.log(`[WS] Connected: ${this.socket.id}`);
      this.emit("connection:change", { state: "connected" });
    });

    this.socket.on("disconnect", (reason) => {
      this.connectionState = "disconnected";
      console.log(`[WS] Disconnected: ${reason}`);
      this.emit("connection:change", { state: "disconnected", reason });
    });

    this.socket.on("connect_error", (err) => {
      this.connectionState = "error";
      console.error("[WS] Connection error:", err.message);
      this.emit("connection:change", { state: "error", message: err.message });
    });

    this.socket.on("reconnecting", (attempt) => {
      this.connectionState = "reconnecting";
      this.emit("connection:change", { state: "reconnecting", attempt });
    });

    // Forward all server events to registered listeners
    const serverEvents = [
      "session:created",
      "session:started",
      "session:stopped",
      "session:cleared",
      "session:stats:response",
      "transcript:update",
      "summary:start",
      "summary:token",
      "summary:complete",
      "summary:error",
      "error",
        "stt:ready",
  "stt:interim",
  "stt:final",
  "stt:error",
  "stt:stopped"
    ];

    serverEvents.forEach((event) => {
      this.socket.on(event, (data) => {
        if (event === "session:created" && data.sessionId) {
          this.sessionId = data.sessionId;
        }
        this.emit(event, data);
      });
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────
// Send a raw event directly to the server socket
send(event, data) {
  this.socket?.emit(event, data);
}
  startSession(fresh = false) {
    this.socket?.emit("session:start", { fresh });
  }

  stopSession() {
    this.socket?.emit("session:stop");
  }

  clearSession() {
    this.socket?.emit("session:clear");
  }

  sendChunk(text) {
    if (!this.socket?.connected) return false;
    this.socket.emit("transcript:chunk", { text });
    return true;
  }

  requestStats() {
    this.socket?.emit("session:stats");
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.sessionId = null;
    this.connectionState = "disconnected";
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }

  // ─── Event Bus (internal pub/sub) ───────────────────────────────────────

  /** Subscribe to an event. Returns unsubscribe function. */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[WS] Listener error for ${event}:`, err);
      }
    });
  }
}

// Singleton — one connection per browser tab
export const socketService = new TranscriptionSocketService();
