# VoiceIntel — Real-time AI Transcription & Summarization

A production-quality MVP for enterprise contact-centre AI assistance.
Captures streaming text input, processes it via WebSocket, and generates
live AI summaries using an LLM — all in real time.

---

## Folder Structure

```
ai-transcription/
├── backend/
│   ├── src/
│   │   ├── server.js                   # Express + Socket.IO entry point
│   │   ├── services/
│   │   │   ├── aiService.js            # AI layer (OpenAI or mock)
│   │   │   ├── sessionManager.js       # Per-user session state
│   │   │   ├── transcriptionProcessor.js  # Core pipeline (buffer → LLM → stream)
│   │   │   └── wsHandler.js            # Socket.IO event handlers
│   │   └── middleware/
│   │       └── rateLimiter.js          # HTTP + WebSocket rate limiting
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Root component
│   │   ├── main.jsx                    # Entry point
│   │   ├── index.css                   # Design system + styles
│   │   ├── components/
│   │   │   ├── StatusIndicator.jsx     # Connection/session status
│   │   │   ├── TranscriptPanel.jsx     # Live transcript + input
│   │   │   ├── SummaryPanel.jsx        # AI summary with streaming animation
│   │   │   ├── ControlBar.jsx          # Start/Stop/Clear controls
│   │   │   └── ErrorToast.jsx          # Error notifications
│   │   ├── hooks/
│   │   │   └── useTranscription.js     # All session state + WebSocket wiring
│   │   └── services/
│   │       └── socketService.js        # Socket.IO client abstraction
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm 9+
- Optional: OpenAI API key (works without one using mock AI)

### 1. Clone / download the project

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env — set OPENAI_API_KEY=sk-... for real AI, or leave as "mock"
npm install
npm run dev       # starts on http://localhost:3001
```

### 3. Frontend setup (separate terminal)

```bash
cd frontend
npm install
npm run dev       # starts on http://localhost:5173
```

### 4. Open the app

Visit **http://localhost:5173** in your browser.

1. The status bar will show **Connected** within a second
2. Click **Start Session**
3. Type in the left panel — text streams to the backend in real time
4. Watch the AI Summary panel update every ~4 seconds
5. Click **Stop Session** to finalize and see session stats
6. Click **Clear** to reset and start over

---

## Using a Real OpenAI API Key

In `backend/.env`:
```
OPENAI_API_KEY=sk-your-key-here
```

The system uses `gpt-4o-mini` for cost efficiency. It generates rolling
incremental summaries — each call only sends the *new* transcript chunk
plus the previous summary, not the full transcript. This minimizes tokens
and latency.

---

## Architecture Deep Dive

### Why WebSockets Instead of REST

REST is synchronous request-response. For transcription, we need:
- Server-to-client push (new summary tokens ready? → push immediately)
- Sub-100ms latency (polling introduces 500ms–2000ms of artificial lag)
- Bidirectional flow (client sends chunks, server sends tokens simultaneously)

WebSockets maintain a persistent TCP connection. Once established,
messages in either direction cost ~2 bytes overhead (vs ~500 bytes for HTTP headers).

Socket.IO adds reconnection logic, named events, and fallback transports —
essential for enterprise networks that block raw WebSocket upgrades.

### Streaming Architecture

```
User types
    │
    ▼
[Frontend buffer]  ─── batched every 150ms ──►  [WebSocket]
                                                      │
                                                      ▼
                                              [Backend receives chunk]
                                                      │
                                              [Append to session buffer]
                                                      │
                                              [Echo transcript update]
                                                      │
                                              [Every 4s: if buffer > 30 chars]
                                                      │
                                              [Lock session (prevent duplicate)]
                                                      │
                                              [Stream to OpenAI]
                                                      │
                                              [Token by token → Socket.IO]
                                                      │
                                                      ▼
                                              [Frontend renders token stream]
                                             (blinking cursor typing effect)
```

Key design decisions:
- **Batching (150ms)**: Prevents flooding backend with single-character events
- **Windowing (4s)**: Prevents LLM from being called on every batch
- **Minimum buffer (30 chars)**: Avoids pointless summarization of whitespace
- **Session lock**: Prevents two concurrent LLM calls for the same user
- **Incremental summarization**: LLM only sees *new* text + previous summary, not full transcript

### Scaling in Production

**Horizontal scaling of WebSocket servers** is non-trivial because a user's
socket connection is sticky to one Node.js instance. The standard solution:

1. **Redis Pub/Sub adapter** (`socket.io-redis`): All instances share a Redis
   channel. When instance A needs to emit to socket on instance B, it publishes
   to Redis; instance B receives and forwards to the socket.

2. **Session state in Redis**: Move `SessionManager` to use `ioredis`. TTL-based
   expiry replaces the in-memory cleanup interval. This also enables session
   restoration across deployments (zero-downtime deploys).

3. **LLM calls as a queue**: Extract `TranscriptionProcessor.triggerSummarization`
   into a BullMQ worker pool. WebSocket instances enqueue jobs; a separate pool
   of worker processes handles LLM calls. This decouples throughput of incoming
   audio from LLM rate limits.

4. **Load balancer sticky sessions**: With the Redis adapter, any instance can
   serve any socket, but sticky sessions reduce cross-instance overhead.

Production topology:
```
[Client] ──► [Load Balancer (sticky)] ──► [WebSocket Instance 1..N]
                                                    │
                                              [Redis Adapter]
                                                    │
                                         [Session State (Redis)]
                                                    │
                                          [LLM Queue (BullMQ)]
                                                    │
                                          [Worker Pool ──► OpenAI]
```

---

## Bonus Features Implemented

✅ **Typing animation for AI responses** — tokens stream in real time with a
blinking cursor, giving the impression the AI is "typing"

✅ **Session history storage** — each session stores past summaries in memory
(`session.summaryHistory`). The REST endpoint `GET /api/sessions/:id` returns
full history including all prior summaries.

✅ **Multiple session support** — the server handles unlimited concurrent sessions.
Each WebSocket connection gets its own isolated session state, processing timer,
and LLM call budget.

✅ **Basic rate limiting** — HTTP endpoints are protected with `express-rate-limit`.
WebSocket messages are rate-limited per socket (200 messages/10s) via a custom
in-memory limiter (`WebSocketRateLimiter`).

✅ **Retry logic for failed LLM calls** — `TranscriptionProcessor` retries up to
3 times with exponential backoff (1s, 2s, 4s) before emitting an error event to
the client.

---

## REST API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Server health check |
| POST | /api/sessions | Pre-register a session |
| GET | /api/sessions/:id | Get session stats + history |
| DELETE | /api/sessions/:id | Delete a session |
| GET | /api/admin/sessions | List all active sessions |

## WebSocket Events Reference

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `session:start` | `{ fresh: bool }` | Start/restart session |
| `session:stop` | — | Stop session (triggers final summary) |
| `session:clear` | — | Clear all data, new session ID |
| `transcript:chunk` | `{ text: string }` | Send a text chunk |
| `session:stats` | — | Request session statistics |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `{ sessionId, hasExistingData, transcript, summary }` | Session initialized |
| `session:started` | `{ sessionId, timestamp }` | Session active |
| `session:stopped` | `{ stats }` | Session stopped with final stats |
| `session:cleared` | `{ newSessionId }` | Session reset |
| `transcript:update` | `{ text, fullTranscript, timestamp }` | New transcript text |
| `summary:start` | — | LLM call beginning |
| `summary:token` | `{ token }` | Streaming LLM token |
| `summary:complete` | `{ summary, timestamp }` | Summary finalized |
| `summary:error` | `{ message }` | LLM call failed |
| `error` | `{ code, message }` | General error |
