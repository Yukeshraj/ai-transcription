/**
 * useTranscription Hook
 *
 * Central state management for the transcription session.
 * All WebSocket interactions, state mutations, and derived values
 * are managed here. Components remain pure display layers.
 *
 * Follows the "single source of truth" principle:
 * - Connection state comes from WebSocket events
 * - Transcript/summary state comes from server echoes
 * - No optimistic updates (we trust the server as the source of truth)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { socketService } from "../services/socketService.js";

const CHUNK_INTERVAL_MS = 150; // How often to send buffered text to server

export function useTranscription() {
  // ─── State ───────────────────────────────────────────────────────────────
  const [connectionState, setConnectionState] = useState("disconnected");
  const [sessionState, setSessionState] = useState("idle"); // idle | active | stopping
  const [sessionId, setSessionId] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [streamingSummary, setStreamingSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sessionStats, setSessionStats] = useState(null);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState("");

  // ─── Refs ────────────────────────────────────────────────────────────────
  // Buffer for outgoing chunks — we batch keystrokes to avoid
  // sending every single character to the backend
  const outboundBuffer = useRef("");
  const chunkTimer = useRef(null);

  // ─── WebSocket Event Subscriptions ───────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      socketService.on("connection:change", ({ state, reason, message }) => {
        setConnectionState(state);
        if (state === "error") {
          setError(message || "Connection failed");
        } else if (state === "connected") {
          setError(null);
        }
      }),

      socketService.on("session:created", (data) => {
        setSessionId(data.sessionId);
        // Restore state if reconnecting to existing session
        if (data.hasExistingData) {
          setTranscript(data.transcript || "");
          setSummary(data.summary || "");
        }
      }),

      socketService.on("session:started", ({ sessionId }) => {
        setSessionState("active");
        setSessionId(sessionId);
      }),

      socketService.on("session:stopped", ({ stats }) => {
        setSessionState("idle");
        setSessionStats(stats);
        stopChunkTimer();
      }),

      socketService.on("session:cleared", ({ newSessionId }) => {
        setSessionId(newSessionId);
        setTranscript("");
        setSummary("");
        setStreamingSummary("");
        setIsSummarizing(false);
        setSessionState("idle");
        setSessionStats(null);
        setInputText("");
      }),

      socketService.on("transcript:update", (data) => {
        setTranscript(data.fullTranscript);
      }),

      socketService.on("summary:start", () => {
        setIsSummarizing(true);
        setStreamingSummary("");
      }),

      socketService.on("summary:token", ({ token }) => {
        setStreamingSummary((prev) => prev + token);
      }),

      socketService.on("summary:complete", ({ summary: newSummary }) => {
        setSummary(newSummary);
        setStreamingSummary("");
        setIsSummarizing(false);
      }),

      socketService.on("summary:error", ({ message }) => {
        setIsSummarizing(false);
        setError(message);
        // Auto-clear error after 5s
        setTimeout(() => setError(null), 5000);
      }),

      socketService.on("error", ({ message, code }) => {
        console.error(`[App Error] ${code}: ${message}`);
        if (code !== "RATE_LIMITED") {
          setError(message);
          setTimeout(() => setError(null), 5000);
        }
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  // ─── Chunk Timer ──────────────────────────────────────────────────────────
  // Batches outbound text into chunks every CHUNK_INTERVAL_MS.
  // This prevents flooding the server with single-character events.

  const startChunkTimer = useCallback(() => {
    if (chunkTimer.current) return;
    chunkTimer.current = setInterval(() => {
      if (outboundBuffer.current.length > 0) {
        const chunk = outboundBuffer.current;
        outboundBuffer.current = "";
        socketService.sendChunk(chunk);
      }
    }, CHUNK_INTERVAL_MS);
  }, []);

  const stopChunkTimer = useCallback(() => {
    if (chunkTimer.current) {
      clearInterval(chunkTimer.current);
      chunkTimer.current = null;
    }
    // Flush any remaining buffer
    if (outboundBuffer.current.length > 0) {
      socketService.sendChunk(outboundBuffer.current);
      outboundBuffer.current = "";
    }
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    socketService.connect();
  }, []);

  const startSession = useCallback(() => {
    if (!socketService.isConnected) {
      socketService.connect();
      // Brief delay to let connection establish
      setTimeout(() => {
        socketService.startSession(true);
        startChunkTimer();
      }, 500);
    } else {
      socketService.startSession(true);
      startChunkTimer();
    }
    setSessionState("active");
    setTranscript("");
    setSummary("");
    setStreamingSummary("");
  }, [startChunkTimer]);

  const stopSession = useCallback(() => {
    setSessionState("stopping");
    stopChunkTimer();
    socketService.stopSession();
  }, [stopChunkTimer]);

  const clearSession = useCallback(() => {
    stopChunkTimer();
    socketService.clearSession();
  }, [stopChunkTimer]);

  /**
   * Handle text input from the textarea.
   * New characters are buffered for batched sending.
   */
  const handleInputChange = useCallback(
    (newText) => {
      if (sessionState !== "active") return;

      const prevText = inputText;
      setInputText(newText);

      // Extract only the newly added text (not deletions)
      if (newText.length > prevText.length) {
        const newChars = newText.slice(prevText.length);
        outboundBuffer.current += newChars;
      }
    },
    [inputText, sessionState]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopChunkTimer();
      socketService.disconnect();
    };
  }, [stopChunkTimer]);

  // ─── Derived Values ───────────────────────────────────────────────────────

  const displaySummary = isSummarizing ? streamingSummary : summary;
  const isActive = sessionState === "active";
  const isStopping = sessionState === "stopping";

  return {
    // State
    connectionState,
    sessionState,
    sessionId,
    transcript,
    summary,
    displaySummary,
    isSummarizing,
    streamingSummary,
    sessionStats,
    error,
    inputText,
    // Derived
    isActive,
    isStopping,
    isConnected: connectionState === "connected",
    // Actions
    connect,
    startSession,
    stopSession,
    clearSession,
    handleInputChange,
  };
}
