import React from "react";
import { Play, Square, Trash2, Loader } from "lucide-react";

export function ControlBar({ sessionState, connectionState, onStart, onStop, onClear, hasContent }) {
  const isActive = sessionState === "active";
  const isStopping = sessionState === "stopping";

  return (
    <div className="control-bar">
      <div className="control-bar__actions">
        {!isActive && !isStopping ? (
          <button className="btn btn--primary btn--lg" onClick={onStart} disabled={isStopping}>
            <Play size={16} />
            Start Session
          </button>
        ) : isStopping ? (
          <button className="btn btn--primary btn--lg" disabled>
            <Loader size={16} className="spin" />
            Finalizing...
          </button>
        ) : (
          <button className="btn btn--danger btn--lg" onClick={onStop}>
            <Square size={16} />
            Stop Session
          </button>
        )}
<button
  className="btn btn--ghost"
  onClick={onClear}
  disabled={!hasContent && sessionState === "idle"}
  title="Clear session"
>
  <Trash2 size={14} />
  Clear
</button>
      </div>
      <div className="control-bar__hints">
        {isActive && <span className="hint hint--active">Streaming to AI · Summary updates every ~4s</span>}
        {!isActive && !isStopping && !hasContent && (
          <span className="hint">Start a session, then type in the transcript panel to begin</span>
        )}
      </div>
    </div>
  );
}
