/**
 * Server Entry Point
 *
 * Bootstraps Express + Socket.IO server with:
 * - CORS configuration
 * - Rate limiting
 * - REST endpoints (session management, health check, admin)
 * - WebSocket setup
 * - Deepgram STT proxy via WebSocket
 * - Graceful shutdown handling
 */

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { WebSocket } from "ws";
import cors from "cors";
import { createAIService } from "./services/aiService.js";
import { TranscriptionProcessor } from "./services/transcriptionProcessor.js";
import { setupWebSocketHandlers } from "./services/wsHandler.js";
import { sessionManager } from "./services/sessionManager.js";
import { httpRateLimiter } from "./middleware/rateLimiter.js";

// ─── App Setup ─────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  ...(process.env.ALLOWED_ORIGINS?.split(",") || []),
];

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "DELETE"],
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));

// ─── Socket.IO ────────────────────────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 5e6, // 5MB — needed for raw audio chunks
});

// ─── Service Initialization ────────────────────────────────────────────────

const aiService = createAIService();
const processor = new TranscriptionProcessor(io, aiService);
setupWebSocketHandlers(io, processor);

// ─── Deepgram STT Proxy ────────────────────────────────────────────────────

/**
 * WHY PROXY DEEPGRAM THROUGH THE BACKEND:
 * Deepgram's WebSocket API requires an API key. Putting the key in the
 * frontend exposes it in the browser. Instead, the frontend streams raw
 * PCM audio to our backend via Socket.IO, and the backend forwards it
 * to Deepgram with the key server-side. Transcripts are sent back to
 * the frontend via the same Socket.IO connection.
 *
 * Flow:
 *   Browser mic → PCM chunks → Socket.IO → backend
 *     → Deepgram WebSocket (key stays server-side)
 *       → transcript text → Socket.IO → frontend
 */

const DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen?" + new URLSearchParams({
  model: "nova-2",
  language: "en-CA",
  punctuate: "true",
  interim_results: "true",
  endpointing: "300",
  smart_format: "true",
});

// Track per-socket Deepgram connections
const dgConnections = new Map(); // socketId → WebSocket

io.on("connection", (socket) => {
  // ─── STT: Start listening ──────────────────────────────────────────────
  socket.on("stt:start", () => {
    if (!process.env.DEEPGRAM_API_KEY) {
      socket.emit("stt:error", { message: "Deepgram API key not configured on server" });
      return;
    }

    // Close any existing Deepgram connection for this socket
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
        if (!alt?.transcript) return;

        const transcript = alt.transcript.trim();
        if (!transcript) return;

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
      socket.emit("stt:error", { message: "Deepgram connection error: " + err.message });
    });

    dgSocket.on("close", (code, reason) => {
      console.log(`[Deepgram] Closed for socket ${socket.id}: ${code} ${reason}`);
      dgConnections.delete(socket.id);
      socket.emit("stt:stopped");
    });
  });

  // ─── STT: Receive audio chunk from browser ─────────────────────────────
  socket.on("stt:audio", (audioChunk) => {
    const dgSocket = dgConnections.get(socket.id);
    if (dgSocket?.readyState === WebSocket.OPEN) {
      dgSocket.send(audioChunk);
    }
  });

  // ─── STT: Stop listening ───────────────────────────────────────────────
  socket.on("stt:stop", () => {
    const dgSocket = dgConnections.get(socket.id);
    if (dgSocket) {
      dgSocket.close();
      dgConnections.delete(socket.id);
      console.log(`[Deepgram] Stopped for socket ${socket.id}`);
    }
  });

  // ─── Cleanup on disconnect ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    const dgSocket = dgConnections.get(socket.id);
    if (dgSocket) {
      dgSocket.close();
      dgConnections.delete(socket.id);
    }
  });
});

// ─── REST Endpoints ────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeSessions: sessionManager.sessions.size,
    uptime: process.uptime(),
    aiService: aiService.constructor.name,
    deepgram: !!process.env.DEEPGRAM_API_KEY,
  });
});

app.post("/api/sessions", (req, res) => {
  const sessionId = crypto.randomUUID();
  sessionManager.getOrCreate(sessionId);
  res.status(201).json({ sessionId });
});

app.get("/api/sessions/:sessionId", (req, res) => {
  const stats = sessionManager.getStats(req.params.sessionId);
  if (!stats) return res.status(404).json({ error: "Session not found" });
  res.json(stats);
});

app.delete("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  processor.stopSession(sessionId);
  sessionManager.deleteSession(sessionId);
  res.status(204).send();
});

app.get("/api/admin/sessions", (req, res) => {
  res.json({
    sessions: sessionManager.getAllSessionStats(),
    total: sessionManager.sessions.size,
  });
});

// ─── Agent Proxy ───────────────────────────────────────────────────────────

app.post("/api/agent", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NVIDIA_AGENT_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_AGENT_MODEL || "meta/llama-3.1-8b-instruct",
        messages,
        temperature: 0.6,
        max_tokens: 80,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      console.error("[Agent proxy] NVIDIA error:", err);
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Agent request timed out" });
    }
    console.error("[Agent proxy] Fetch error:", err);
    res.status(500).json({ error: "Agent request failed" });
  }
});

app.use(httpRateLimiter);

// ─── 404 / Error Handlers ──────────────────────────────────────────────────

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ──────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   AI Transcription Backend — Running             ║
║   HTTP + WebSocket: http://localhost:${PORT}       ║
║   Health check:     /health                      ║
║   Deepgram STT:     ${process.env.DEEPGRAM_API_KEY ? "✅ configured" : "⚠️  no key"}          ║
╚══════════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);

  // Close all Deepgram connections
  for (const [, dgSocket] of dgConnections) dgSocket.close();
  dgConnections.clear();

  httpServer.close(() => {
    console.log("[Server] HTTP server closed");
    io.close(() => {
      console.log("[Server] Socket.IO closed");
      sessionManager.destroy();
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("[Server] Force shutdown after timeout");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));