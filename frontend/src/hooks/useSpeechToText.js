/**
 * useSpeechToText Hook
 *
 * Uses the browser's built-in Web Speech API (SpeechRecognition).
 * No API key, no external service — works natively in Chrome/Edge.
 *
 * Limitations vs Deepgram:
 * - Chrome only (not Firefox)
 * - Requires internet connection (Chrome sends audio to Google's servers)
 * - Less accurate than Deepgram nova-2 for accents
 * - No custom vocabulary
 *
 * For an RBC contact centre demo this is perfectly sufficient.
 */

import { useState, useRef, useCallback, useEffect } from "react";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechToText({ onTranscript, onFinalTranscript }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;       // Keep listening until stopped
    recognition.interimResults = true;   // Show live partial results
    recognition.lang = "en-CA";          // Canadian English for RBC
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("[STT] Web Speech API started");
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      if (interimTranscript) {
        onTranscript?.(interimTranscript);
      }

      if (finalTranscript.trim()) {
        onFinalTranscript?.(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("[STT] Error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone permission denied — please allow mic access in your browser.");
      } else if (event.error === "no-speech") {
        // Not a real error — just silence, keep listening
        return;
      } else {
        setError("Speech recognition error: " + event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("[STT] Web Speech API ended");
      // Auto-restart if still supposed to be listening
      // (Chrome stops recognition after ~60s of silence)
      if (recognitionRef.current === recognition && isListening) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("[STT] Start error:", err);
      setError("Could not start speech recognition: " + err.message);
    }
  }, [onTranscript, onFinalTranscript, isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setError(null);
  }, []);

  return { isListening, error, start, stop };
}