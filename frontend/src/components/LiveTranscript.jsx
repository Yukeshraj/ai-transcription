import React, { useEffect, useRef, useState, useCallback } from "react";
import { Circle, Loader, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useSpeechToText } from "../hooks/useSpeechToText.js";

const SYSTEM_PROMPT = `You are Samantha, a Senior Client Services Representative at RBC (Royal Bank of Canada) with 15 years of experience. You are handling a live inbound phone call.

PERSONALITY:
- Warm but professional — like a trusted advisor, not a script-reader
- Calm under pressure, never flustered
- Naturally empathetic without being over-the-top
- Confident in your knowledge, honest about what you don't know

CALL HANDLING BEHAVIOUR:
- Always greet with your name on the first message: "Thank you for calling RBC, this is Karen, how can I help you today?"
- After that, never re-introduce yourself
- Mirror the customer's emotional tone — if they're stressed, slow down and reassure; if they're casual, match that energy
- Never ask more than ONE question at a time
- Always acknowledge what the customer said before asking anything
- If the customer is upset, validate first before solving: "I completely understand why that's frustrating..."
- Use natural filler phrases occasionally: "Absolutely", "Of course", "Let me take a look at that for you"
- Pause points: when you need to "look something up", say "Just give me one moment while I pull that up"

VERIFICATION PROTOCOL:
- Before discussing any account details, verify: full name + date of birth OR last 4 digits of card
- Say: "For your security, I just need to verify a couple of things before we proceed"
- Never skip verification even if the customer volunteers account info

BOUNDARIES:
- Never invent account balances, transaction amounts, or policy details
- If asked something outside your scope: "That's a great question — let me connect you with our [specialist team] who can give you the most accurate answer on that"
- Never say you are an AI, a bot, or a virtual assistant
- Never use corporate jargon like "per our policy" or "as per"
- Keep responses to 2-3 sentences maximum — you are on a phone call, not writing an email

TONE EXAMPLES:
- Too robotic: "I can assist you with that request. Please provide verification."
- Correct: "Of course, I'd be happy to help with that. Just to keep your account secure, could I grab your full name and date of birth?"

- Too formal: "I apologize for the inconvenience this has caused you."
- Correct: "I'm really sorry about that — that's not the experience we want you to have at all."`;

const MOCK_RESPONSES = [
  "Thank you for calling RBC. I can certainly help you with your account balance — for security purposes, could I get your full name and the last four digits of your card?",
  "Absolutely, I can look into that transaction for you. Could you confirm the date and approximate amount you're seeing on your statement?",
  "I understand that must be concerning. I'm going to place a temporary hold on that card right now and we'll get a replacement sent out to your address on file — does that work for you?",
  "That's a great question. The daily ATM limit on your account is typically $1,000, but I can review your account to see if an increase is available for you.",
  "I can help with a stop payment on that cheque. I'll just need the cheque number and the amount — do you have that handy?",
  "I completely understand the frustration. Let me pull up your account and see exactly what happened with that fee — one moment please.",
  "We do offer mortgage renewal options, and I'd love to get you connected with one of our mortgage specialists who can walk you through the best rates available right now.",
];

let mockIdx = 0;

function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function useCallTimer(isActive) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (isActive) {
      setSeconds(0);
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [isActive]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function speak(text, enabled) {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-CA";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Neural") || v.name.includes("Samantha") || v.name.includes("Google"))
  );
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

async function callAgent(history) {
  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((e) => ({
        role: e.speaker === "agent" ? "assistant" : "user",
        content: e.text,
      })),
    ];
    const res = await fetch("http://localhost:3001/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || MOCK_RESPONSES[0];
  } catch (err) {
    console.error("Agent error:", err);
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    return MOCK_RESPONSES[mockIdx++ % MOCK_RESPONSES.length];
  }
}

const S = {
  root: {
    display: "flex", flexDirection: "column",
    height: "100%", overflow: "hidden",
    background: "#ffffff",
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 16px", height: 40,
    borderBottom: "1px solid #ebebeb",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  liveLabel: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 9, fontWeight: 700, color: "#dc0032",
    letterSpacing: "0.14em", textTransform: "uppercase",
  },
  divider: { width: 1, height: 12, background: "#e5e5e5" },
  duration: { fontSize: 10, color: "#9b9b9b", letterSpacing: "0.04em" },
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  wordCount: { fontSize: 9, color: "#cccccc", letterSpacing: "0.06em" },
  clock: { fontSize: 10, color: "#9b9b9b", letterSpacing: "0.04em" },
  feed: {
    flex: 1, overflowY: "auto",
    padding: "16px 20px",
    display: "flex", flexDirection: "column", gap: 16,
  },
  entry: (isLast, speaker) => ({
    borderLeft: isLast && speaker === "agent" ? "2px solid #dc0032" : "2px solid transparent",
    paddingLeft: 10,
    background: isLast && speaker === "agent" ? "#fffafa" : "transparent",
    marginLeft: -12,
    paddingTop: isLast ? 6 : 0,
    paddingBottom: isLast ? 6 : 0,
    borderRadius: isLast ? "0 4px 4px 0" : 0,
    transition: "background 0.2s",
  }),
  entryMeta: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 },
  speaker: (isAgent) => ({
    fontSize: 8, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.14em",
    color: isAgent ? "#dc0032" : "#1a1a1a",
  }),
  timestamp: { fontSize: 8, color: "#dddddd", letterSpacing: "0.04em" },
  entryText: {
    fontSize: 13, lineHeight: 1.65,
    color: "#1a1a1a", letterSpacing: "-0.01em",
    margin: 0,
  },
  interimText: {
    fontSize: 13, lineHeight: 1.65,
    color: "#bbbbbb", letterSpacing: "-0.01em",
    margin: 0, fontStyle: "italic",
  },
  cursor: {
    display: "inline-block", width: 5, height: 14,
    background: "#dc0032", marginLeft: 3,
    verticalAlign: "middle",
    animation: "blink 1s step-end infinite",
  },
  thinkingRow: {
    display: "flex", alignItems: "center", gap: 8,
    paddingLeft: 10, marginLeft: -12,
  },
  thinkingLabel: {
    fontSize: 9, color: "#dc0032", fontWeight: 600,
    letterSpacing: "0.1em", textTransform: "uppercase",
  },
  empty: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 6, textAlign: "center", padding: 32,
  },
  emptyTitle: { fontSize: 12, color: "#cccccc", margin: 0 },
  emptyHint: { fontSize: 9, color: "#dddddd", letterSpacing: "0.06em", lineHeight: 1.7, margin: 0 },
  inputArea: {
    borderTop: "1px solid #ebebeb",
    padding: "10px 16px 12px",
    flexShrink: 0,
    background: "#fafafa",
  },
  inputMeta: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#cccccc" },
  inputHint: { fontSize: 8, color: "#dddddd", letterSpacing: "0.04em" },
  inputRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  textarea: {
    flex: 1, background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 6,
    padding: "9px 12px", fontSize: 11,
    color: "#1a1a1a", resize: "none", outline: "none",
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
    lineHeight: 1.65, letterSpacing: "-0.01em",
    transition: "border-color 0.15s",
  },
  sendBtn: {
    flexShrink: 0, height: 36, padding: "0 14px",
    background: "#dc0032", color: "#fff", border: "none", borderRadius: 6,
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    cursor: "pointer", transition: "background 0.15s, opacity 0.15s",
  },
  iconBtn: (active, color = "#dc0032") => ({
    flexShrink: 0, width: 36, height: 36,
    background: active ? color : "#f5f5f5",
    color: active ? "#fff" : "#9b9b9b",
    border: active ? "none" : "1px solid #e8e8e8",
    borderRadius: 6, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  }),
  errorBar: {
    fontSize: 9, color: "#dc0032", letterSpacing: "0.06em",
    padding: "4px 0", textAlign: "center",
  },
};

export function LiveTranscript({ isActive, sessionState, clearKey, onInputChange }) {
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const timer = useCallTimer(isActive);
  const [entries, setEntries] = useState([]);
  const [inputText, setInputText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [currentTime, setCurrentTime] = useState(getTimestamp());
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Refs to prevent double-firing
  const isAgentThinkingRef = useRef(false);
  const ttsEnabledRef = useRef(true);
  const onInputChangeRef = useRef(onInputChange);
  useEffect(() => { onInputChangeRef.current = onInputChange; }, [onInputChange]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // ─── Agent reply ───────────────────────────────────────────────────────
  const triggerAgentReply = useCallback(async (currentEntries) => {
    // Guard against double calls
    if (isAgentThinkingRef.current) return;
    isAgentThinkingRef.current = true;
    setIsAgentThinking(true);

    const reply = await callAgent(currentEntries);

    const agentEntry = {
      id: String(Date.now()),
      speaker: "agent",
      text: reply,
      timestamp: getTimestamp(),
    };

    setEntries((prev) => {
      const finalEntries = [...prev, agentEntry];
      if (onInputChangeRef.current) {
        const fullText = finalEntries
          .map((e) => `${e.speaker.toUpperCase()}: ${e.text}`)
          .join("\n");
        onInputChangeRef.current(fullText);
      }
      return finalEntries;
    });

    isAgentThinkingRef.current = false;
    setIsAgentThinking(false);
    speak(reply, ttsEnabledRef.current);
  }, []);

  // ─── STT handlers ─────────────────────────────────────────────────────
  const handleInterimTranscript = useCallback((transcript) => {
    if (!isActive) return;
    setInterimText(transcript);
  }, [isActive]);

  const handleFinalTranscript = useCallback((transcript) => {
    // Use refs to get latest values without stale closure
    if (!isActive || isAgentThinkingRef.current) return;
    setInterimText("");

    const customerEntry = {
      id: String(Date.now()),
      speaker: "customer",
      text: transcript,
      timestamp: getTimestamp(),
    };

    // Use functional update to get latest entries, then trigger agent once
    setEntries((prev) => {
      const next = [...prev, customerEntry];
      // Schedule agent reply outside of setState
      Promise.resolve().then(() => triggerAgentReply(next));
      return next;
    });
  }, [isActive, triggerAgentReply]);

  const { isListening, error: sttError, start: startSTT, stop: stopSTT } = useSpeechToText({
    onTranscript: handleInterimTranscript,
    onFinalTranscript: handleFinalTranscript,
  });

  // ─── Clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(getTimestamp()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Clear ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (clearKey === 0) return;
    setEntries([]);
    setInputText("");
    setInterimText("");
    isAgentThinkingRef.current = false;
    window.speechSynthesis?.cancel();
  }, [clearKey]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries, isAgentThinking, interimText]);

  // ─── Focus textarea ───────────────────────────────────────────────────
  useEffect(() => {
    if (isActive && textareaRef.current) textareaRef.current.focus();
  }, [isActive]);

  // ─── Stop STT + TTS when session ends ─────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      if (isListening) stopSTT();
      window.speechSynthesis?.cancel();
    }
  }, [isActive, isListening, stopSTT]);

  // ─── Manual send ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isAgentThinkingRef.current || !isActive) return;
    const customerEntry = {
      id: String(Date.now()),
      speaker: "customer",
      text,
      timestamp: getTimestamp(),
    };
    const nextEntries = [...entries, customerEntry];
    setEntries(nextEntries);
    setInputText("");
    await triggerAgentReply(nextEntries);
  }, [inputText, isActive, entries, triggerAgentReply]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const toggleMic = useCallback(() => {
    isListening ? stopSTT() : startSTT();
  }, [isListening, startSTT, stopSTT]);

  const toggleTts = useCallback(() => {
    setTtsEnabled((v) => {
      if (v) window.speechSynthesis?.cancel();
      ttsEnabledRef.current = !v;
      return !v;
    });
  }, []);

  const wordCount = entries.map((e) => e.text).join(" ").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div style={S.root}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes micpulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,0,50,0.4)} 50%{box-shadow:0 0 0 6px rgba(220,0,50,0)} }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          {isActive ? (
            <>
              <div style={S.liveLabel}>
                <Circle size={7} style={{ fill: "#dc0032", color: "#dc0032" }} />
                Live Recording
              </div>
              <div style={S.divider} />
              <span style={S.duration}>Call Duration: {timer}</span>
              {isListening && (
                <>
                  <div style={S.divider} />
                  <span style={{ fontSize: 9, color: "#dc0032", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>
                    🎙 Listening
                  </span>
                </>
              )}
            </>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#cccccc" }}>
              Transcript
            </span>
          )}
        </div>
        <div style={S.headerRight}>
          {wordCount > 0 && <span style={S.wordCount}>{wordCount} words</span>}
          <span style={S.clock}>{currentTime}</span>
        </div>
      </div>

      {sttError && <div style={S.errorBar}>{sttError}</div>}

      {/* Feed */}
      <div ref={scrollRef} style={S.feed}>
        {entries.length > 0 || interimText ? (
          <>
            {entries.map((entry, idx) => {
              const isLast = idx === entries.length - 1 && !isAgentThinking && !interimText;
              return (
                <div key={entry.id} style={S.entry(isLast, entry.speaker)}>
                  <div style={S.entryMeta}>
                    <span style={S.speaker(entry.speaker === "agent")}>{entry.speaker}</span>
                    <span style={S.timestamp}>{entry.timestamp}</span>
                  </div>
                  <p style={S.entryText}>
                    {entry.text}
                    {isLast && entry.speaker === "agent" && <span style={S.cursor} />}
                  </p>
                </div>
              );
            })}
            {interimText && (
              <div style={{ paddingLeft: 10, marginLeft: -12 }}>
                <div style={S.entryMeta}>
                  <span style={S.speaker(false)}>customer</span>
                  <span style={S.timestamp}>live...</span>
                </div>
                <p style={S.interimText}>{interimText}<span style={S.cursor} /></p>
              </div>
            )}
            {isAgentThinking && (
              <div style={S.thinkingRow}>
                <Loader size={11} color="#dc0032" style={{ animation: "spin 1s linear infinite" }} />
                <span style={S.thinkingLabel}>Agent responding...</span>
              </div>
            )}
          </>
        ) : (
          <div style={S.empty}>
            <p style={S.emptyTitle}>
              {isActive ? "Type below or click the mic to speak" : "Start a session to begin transcription"}
            </p>
            <p style={S.emptyHint}>
              {isActive ? "🎙 Real-time speech recognition · or type manually" : "The RBC AI agent will respond to every customer message automatically"}
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={S.inputArea}>
        <div style={S.inputMeta}>
          <span style={S.inputLabel}>Customer Input</span>
          <span style={S.inputHint}>
            {isAgentThinking ? "Agent is responding..." : isListening ? "Listening..." : isActive ? "Press Enter or Send · or use mic" : "Inactive"}
          </span>
        </div>
        <div style={S.inputRow}>
          <button
            style={{
              ...S.iconBtn(isListening),
              animation: isListening ? "micpulse 1.5s ease-in-out infinite" : "none",
              opacity: !isActive ? 0.4 : 1,
              cursor: !isActive ? "not-allowed" : "pointer",
            }}
            onClick={toggleMic}
            disabled={!isActive}
            title={isListening ? "Stop microphone" : "Start microphone"}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            style={{
              ...S.iconBtn(ttsEnabled, "#1a6b3a"),
              opacity: !isActive ? 0.4 : 1,
              cursor: !isActive ? "not-allowed" : "pointer",
            }}
            onClick={toggleTts}
            disabled={!isActive}
            title={ttsEnabled ? "Mute agent voice" : "Enable agent voice"}
          >
            {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isActive || isAgentThinking || isListening}
            placeholder={isListening ? "Speaking via microphone..." : "Hi, I'd like to check my account balance..."}
            rows={2}
            style={{
              ...S.textarea,
              opacity: (isAgentThinking || isListening) ? 0.5 : 1,
              cursor: (isAgentThinking || isListening) ? "not-allowed" : "text",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#dc0032")}
            onBlur={(e) => (e.target.style.borderColor = "#e8e8e8")}
          />
          <button
            style={{
              ...S.sendBtn,
              opacity: isAgentThinking || !isActive || isListening ? 0.4 : 1,
              cursor: isAgentThinking || !isActive || isListening ? "not-allowed" : "pointer",
            }}
            onClick={handleSend}
            disabled={!isActive || isAgentThinking || isListening}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}