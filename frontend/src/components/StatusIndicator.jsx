import React from "react";

const STATE_CONFIG = {
  connected:    { label: "Connected",    color: "#34d399", pulse: true  },
  disconnected: { label: "Disconnected", color: "#4e5a72", pulse: false },
  reconnecting: { label: "Reconnecting", color: "#f59e0b", pulse: true  },
  error:        { label: "Error",        color: "#ef4444", pulse: false },
};

export function StatusIndicator({ connectionState, sessionState, sessionId }) {
  const cfg = STATE_CONFIG[connectionState] || STATE_CONFIG.disconnected;
  const sessionLabel =
    sessionState === "active"   ? "● Recording" :
    sessionState === "stopping" ? "◌ Finalizing" : "○ Standby";

  return (
    <div className="status-bar">
      <div className="status-connection">
        <span className={`status-dot ${cfg.pulse ? "status-dot--pulse" : ""}`} style={{ "--dot-color": cfg.color }} />
        <span className="status-label">{cfg.label}</span>
      </div>
      <div className={`status-session status-session--${sessionState}`}>{sessionLabel}</div>
      {sessionId && (
        <div className="status-session-id" title={sessionId}>
          {sessionId.slice(0, 8)}
        </div>
      )}
    </div>
  );
}
