import React, { useEffect, useState, useCallback } from "react";
import { useTranscription } from "./hooks/useTranscription.js";
import { CustomTitlebar } from "./components/CustomTitlebar.jsx";
import { CustomerContext } from "./components/CustomerContext.jsx";
import { LiveTranscript } from "./components/LiveTranscript.jsx";
import { AISummary } from "./components/AISummary.jsx";
import { ErrorToast } from "./components/ErrorToast.jsx";
import { socketService } from "./services/socketService.js";

export default function App() {
  const {
    connectionState, sessionState, sessionId,
    transcript, displaySummary, summary,
    isSummarizing, sessionStats, error, inputText,
    isActive, isStopping,
    startSession, stopSession, clearSession, handleInputChange,
  } = useTranscription();

  const [clearKey, setClearKey] = useState(0);

  useEffect(() => { socketService.connect(); }, []);

  const handleClear = useCallback(() => {
    setClearKey(k => k + 1);
    clearSession();
  }, [clearSession]);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#f4f4f4", fontFamily: "'IBM Plex Mono', 'Menlo', monospace" }}
    >
      <CustomTitlebar
        connectionState={connectionState}
        sessionState={sessionState}
        sessionId={sessionId}
        onStart={startSession}
        onStop={stopSession}
        onClear={handleClear}
        isActive={isActive}
        isStopping={isStopping}
        hasContent={transcript.length > 0}
      />

      {/* Three-column workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden gap-px" style={{ background: "#e0e0e0" }}>

        {/* Left — Customer Context */}
        <div
          className="flex-shrink-0 overflow-hidden flex flex-col"
          style={{ width: 248, background: "#ffffff" }}
        >
          <CustomerContext />
        </div>

        {/* Center — Live Transcript */}
        <div
          className="flex-1 min-w-0 overflow-hidden flex flex-col"
          style={{ background: "#ffffff" }}
        >
          <LiveTranscript
            isActive={isActive}
            onInputChange={handleInputChange}
            sessionState={sessionState}
            clearKey={clearKey}
          />
        </div>

        {/* Right — AI Analysis */}
        <div
          className="flex-shrink-0 overflow-hidden flex flex-col"
          style={{ width: 308, background: "#ffffff" }}
        >
          <AISummary
            summary={summary}
            displaySummary={displaySummary}
            isSummarizing={isSummarizing}
            transcript={transcript}
            sessionStats={sessionStats}
          />
        </div>

      </div>

      <ErrorToast message={error} />
    </div>
  );
}