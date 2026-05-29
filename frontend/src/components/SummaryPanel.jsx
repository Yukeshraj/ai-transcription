import React, { useEffect, useRef } from "react";
import { Brain, Loader, Sparkles } from "lucide-react";

export function SummaryPanel({ summary, displaySummary, isSummarizing, sessionStats }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current && isSummarizing)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displaySummary, isSummarizing]);

  return (
    <div className={`panel panel--summary ${isSummarizing ? "panel--processing" : ""}`}>
      <div className="panel__header">
        <div className="panel__title-group">
          <div className={`panel__icon panel__icon--ai ${isSummarizing ? "panel__icon--spinning" : ""}`}>
            {isSummarizing ? <Loader size={15} /> : <Brain size={15} />}
          </div>
          <h2 className="panel__title">AI Summary</h2>
        </div>
        <div className="panel__meta">
          {isSummarizing && (
            <span className="panel__ai-badge"><span className="ai-dot" />Analyzing</span>
          )}
          {sessionStats && !isSummarizing && (
            <span className="panel__word-count">
              {sessionStats.summaryCount} update{sessionStats.summaryCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="panel__summary-display" ref={scrollRef}>
        {displaySummary ? (
          <div className="summary__content">
            <p className="summary__text">
              {displaySummary}
              {isSummarizing && <span className="summary__cursor">▋</span>}
            </p>
            {isSummarizing && summary && summary !== displaySummary && (
              <p className="summary__previous">
                <span className="summary__previous-label">Previous</span>
                {summary}
              </p>
            )}
          </div>
        ) : (
          <div className="panel__empty">
            <Sparkles size={28} className="panel__empty-icon" />
            <p>{isSummarizing ? "Generating first summary..." : "AI summary will appear here as you transcribe"}</p>
            {!isSummarizing && <p className="panel__empty-sub">Updated every ~4 seconds</p>}
          </div>
        )}
      </div>

      {isSummarizing && (
        <div className="panel__processing-bar">
          <div className="processing-bar__fill" />
        </div>
      )}

      {sessionStats && (
        <div className="panel__stats-footer">
          <span>Duration: {sessionStats.duration}s</span>
          <span>·</span>
          <span>{sessionStats.chunkCount} chunks</span>
          <span>·</span>
          <span>{sessionStats.summaryCount} summaries</span>
        </div>
      )}
    </div>
  );
}
