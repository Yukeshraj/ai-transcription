import React from "react";
import { Play, Square, Trash2, Loader, Circle } from "lucide-react";

const CONNECTION_STATES = {
  connected:    { label: "Connected",    color: "#16a34a" },
  disconnected: { label: "Disconnected", color: "#9b9b9b" },
  reconnecting: { label: "Reconnecting", color: "#d97706" },
  error:        { label: "Error",        color: "#dc0032" },
};

export function CustomTitlebar({
  connectionState, sessionState, sessionId,
  onStart, onStop, onClear,
  isActive, isStopping, hasContent,
}) {
  const conn = CONNECTION_STATES[connectionState] || CONNECTION_STATES.disconnected;

  return (
    <div
      style={{
        height: 44,
        background: "#1a1a1a",
        borderBottom: "1px solid #2e2e2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 16,
        paddingRight: 16,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Left — branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* Traffic lights placeholder */}
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* RBC red accent bar */}
          <div style={{ width: 3, height: 18, background: "#dc0032", borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#ffffff", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            RBC Contact Centre
          </span>
          <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            · Agent Workstation
          </span>
        </div>
      </div>

      {/* Center — session controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!isActive && !isStopping ? (
          <button onClick={onStart} style={btnStyle("#dc0032", "#ffffff")}>
            <Play size={12} style={{ flexShrink: 0 }} />
            Start Session
          </button>
        ) : isStopping ? (
          <button disabled style={btnStyle("#2e2e2e", "#6b6b6b")}>
            <Loader size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
            Finalizing...
          </button>
        ) : (
          <button onClick={onStop} style={btnStyle("#2e2e2e", "#ffffff", "#dc0032")}>
            <Square size={12} style={{ flexShrink: 0 }} />
            Stop
          </button>
        )}

        <button
          onClick={onClear}
          disabled={isActive || (!hasContent && sessionState === "idle")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 5,
            background: "transparent",
            border: "1px solid #2e2e2e",
            color: isActive ? "#3a3a3a" : "#8a8a8a",
            fontSize: 11, fontWeight: 500, cursor: isActive ? "not-allowed" : "pointer",
            transition: "border-color 0.15s",
          }}
        >
          <Trash2 size={11} />
          Clear
        </button>
      </div>

      {/* Right — status */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Session state pill */}
        {isActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Circle
              size={7}
              style={{ fill: "#dc0032", color: "#dc0032", animation: "pulse 1.5s ease-in-out infinite" }}
            />
            <span style={{ fontSize: 10, color: "#dc0032", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Live
            </span>
          </div>
        )}

        {/* Connection indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: conn.color }} />
          <span style={{ fontSize: 10, color: "#5a5a5a", letterSpacing: "0.06em" }}>
            {conn.label}
          </span>
        </div>

        {/* Session ID */}
        {sessionId && (
          <span style={{ fontSize: 9, color: "#3a3a3a", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            {sessionId.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}

function btnStyle(bg, color, hoverBorder) {
  return {
    display: "flex", alignItems: "center", gap: 6,
    padding: "5px 12px", borderRadius: 5,
    background: bg,
    border: `1px solid ${hoverBorder || bg}`,
    color,
    fontSize: 11, fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "opacity 0.15s",
  };
}