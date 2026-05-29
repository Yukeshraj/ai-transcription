import React, { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

export function ErrorToast({ message }) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (message) {
      setDisplayed(message);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  if (!displayed) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 999,
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "11px 14px",
        background: "#1a1a1a",
        border: "1px solid #dc0032",
        borderRadius: 6,
        maxWidth: 340,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <AlertCircle size={14} color="#dc0032" style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 11, color: "#ffffff", lineHeight: 1.5, flex: 1, margin: 0 }}>
        {displayed}
      </p>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#555555", padding: 0, flexShrink: 0,
          display: "flex", alignItems: "center",
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}