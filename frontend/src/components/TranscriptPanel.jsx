import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Type } from "lucide-react";

export function TranscriptPanel({ transcript, inputText, isActive, onInputChange, sessionState }) {
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    if (isActive && textareaRef.current) textareaRef.current.focus();
  }, [isActive]);

  const wordCount = transcript ? transcript.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className={`panel panel--transcript ${isActive ? "panel--active" : ""}`}>
      <div className="panel__header">
        <div className="panel__title-group">
          <div className={`panel__icon ${isActive ? "panel__icon--recording" : ""}`}>
            {isActive ? <Mic size={15} /> : <MicOff size={15} />}
          </div>
          <h2 className="panel__title">Live Transcript</h2>
        </div>
        <div className="panel__meta">
          {wordCount > 0 && <span className="panel__word-count">{wordCount} words</span>}
          {isActive && (
            <span className="panel__recording-badge">
              <span className="recording-dot" />LIVE
            </span>
          )}
        </div>
      </div>

      <div className="panel__transcript-display" ref={scrollRef}>
        {transcript ? (
          <p className="transcript__text">{transcript}</p>
        ) : (
          <div className="panel__empty">
            <Type size={28} className="panel__empty-icon" />
            <p>{isActive ? "Start typing below to stream your transcript..." : "Start a session to begin transcribing"}</p>
          </div>
        )}
      </div>

      <div className="panel__input-area">
        <div className="panel__input-label">
          <span>Simulate Audio Input</span>
          <span className="panel__input-hint">{isActive ? "Type to stream" : "Inactive"}</span>
        </div>
        <textarea
          ref={textareaRef}
          className="panel__textarea"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={!isActive}
          placeholder={isActive
            ? "Type here to simulate speech input — text streams to AI in real time..."
            : "Start a session to enable input"}
          rows={4}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
