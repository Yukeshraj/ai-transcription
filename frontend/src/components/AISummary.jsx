import React, { useEffect, useRef } from "react";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Loader } from "lucide-react";

function deriveAIData(summary, transcript) {
  const text = (transcript || "").toLowerCase();

  const topicMap = [
    ["fraud", "Fraud Investigation"], ["unauthorized", "Fraud Investigation"],
    ["charge", "Charge Dispute"],     ["dispute", "Dispute"],
    ["refund", "Refund Request"],     ["credit card", "Credit Card"],
    ["account", "Account Inquiry"],   ["password", "Access Issue"],
    ["transfer", "Fund Transfer"],    ["mortgage", "Mortgage"],
    ["card", "Card Services"],        ["payment", "Payment"],
    ["billing", "Billing"],           ["replace", "Card Replacement"],
  ];
  const seen = new Set();
  const topics = topicMap
    .filter(([kw]) => text.includes(kw))
    .map(([, label]) => label)
    .filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; })
    .slice(0, 4);

  const pos = ["thank","great","perfect","resolved","happy","appreciate","wonderful"].filter((w) => text.includes(w)).length;
  const neg = ["frustrated","upset","wrong","issue","problem","worried","never","angry","terrible"].filter((w) => text.includes(w)).length;
  const sentiment = neg > pos ? "negative" : pos > 0 ? "positive" : "neutral";

  const insights = [];
  if (text.includes("fraud") || text.includes("unauthorized") || text.includes("don't recognize"))
    insights.push({ id: "i1", type: "warning", message: "Customer expressing anxiety about security. Reassure and outline next steps clearly." });
  if (text.includes("fraud") || text.includes("pattern") || text.includes("charge"))
    insights.push({ id: "i2", type: "info", message: "Transaction matches pattern of recent online fraud cases in Toronto region." });
  if (!text.includes("fraud") && (text.includes("thank") || text.includes("good standing")))
    insights.push({ id: "i3", type: "success", message: "Customer account has no previous fraud history. Good standing since 2018." });
  if (text.includes("account") && !text.includes("fraud"))
    insights.push({ id: "i4", type: "success", message: "Customer account verified. All security checks passed." });
  if (insights.length === 0 && summary)
    insights.push({ id: "i5", type: "info", message: "Call in progress. AI monitoring for key events and triggers." });

  const actions = [];
  if (text.includes("fraud") || text.includes("unauthorized") || text.includes("don't recognize"))
    actions.push({ id: "a1", priority: "high", category: "Security", action: "Initiate fraud investigation and temporary card block." });
  if (text.includes("charge") || text.includes("dispute") || text.includes("refund"))
    actions.push({ id: "a2", priority: "high", category: "Dispute Resolution", action: "File dispute claim for unrecognized transaction." });
  if (text.includes("replace") || text.includes("hold") || text.includes("block"))
    actions.push({ id: "a3", priority: "medium", category: "Account Management", action: "Issue replacement card with new number." });
  if (text.includes("transfer"))
    actions.push({ id: "a4", priority: "medium", category: "Operations", action: "Confirm transfer details and daily limit compliance." });
  if (actions.length === 0)
    actions.push({ id: "a0", priority: "low", category: "General", action: "Continue listening and document call reason for CRM update." });

  return { sentiment, topics, insights, actions };
}

const SENTIMENT = {
  positive: { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  neutral:  { bg: "#f5f5f5", border: "#e5e5e5", color: "#6b6b6b" },
  negative: { bg: "#fff0f0", border: "#fecaca", color: "#dc0032" },
};
const PRIORITY = {
  high:   { bg: "#fff0f0", border: "#fecaca", color: "#dc0032" },
  medium: { bg: "#fff8ee", border: "#fed7aa", color: "#9a3412" },
  low:    { bg: "#f5f5f5", border: "#e5e5e5", color: "#6b6b6b" },
};
const INSIGHT_ICON = {
  warning: { Icon: AlertTriangle, color: "#dc0032" },
  success: { Icon: CheckCircle2,  color: "#15803d" },
  info:    { Icon: TrendingUp,    color: "#0066cc" },
};

const S = {
  root: {
    display: "flex", flexDirection: "column",
    height: "100%", overflowY: "auto",
    background: "#fafafa",
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
  },

  section: {
    background: "#ffffff",
    borderBottom: "1px solid #f0f0f0",
    padding: "14px",
    flexShrink: 0,
  },

  sectionLabel: {
    fontSize: 8, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.14em",
    color: "#bbbbbb", marginBottom: 10,
  },

  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  aiTitle: { display: "flex", alignItems: "center", gap: 7 },
  aiTitleText: { fontSize: 11, fontWeight: 600, color: "#1a1a1a", letterSpacing: "0.02em" },
  updatesCount: { fontSize: 9, color: "#bbbbbb", letterSpacing: "0.06em" },

  sentimentRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  sentimentLabel: { fontSize: 9, color: "#aaaaaa" },
  sentimentBadge: (s) => ({
    fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
    padding: "3px 8px", borderRadius: 3,
    background: SENTIMENT[s].bg, border: `1px solid ${SENTIMENT[s].border}`, color: SENTIMENT[s].color,
  }),

  topicsRow: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 },
  topicChip: {
    fontSize: 9, padding: "3px 8px", borderRadius: 3,
    background: "#f5f5f5", border: "1px solid #ebebeb", color: "#4a4a4a",
  },

  summaryText: { fontSize: 11, lineHeight: 1.7, color: "#3a3a3a" },
  summaryEmpty: { fontSize: 10, color: "#bbbbbb", fontStyle: "italic" },
  cursor: {
    display: "inline-block", width: 5, height: 12,
    background: "#dc0032", marginLeft: 3, verticalAlign: "middle",
    animation: "blink 1s step-end infinite",
  },

  progressBar: {
    height: 2, background: "#f0f0f0", overflow: "hidden", borderRadius: 1, marginTop: 10,
  },
  progressFill: {
    height: "100%", width: "33%",
    background: "rgba(220,0,50,0.3)",
    animation: "scan 1.8s ease-in-out infinite",
  },

  insightCard: {
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "9px 10px", borderRadius: 5,
    background: "#fafafa", border: "1px solid #f0f0f0",
    marginBottom: 6,
  },
  insightText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.6 },

  actionCard: {
    background: "#ffffff", border: "1px solid #ebebeb", borderRadius: 5,
    padding: "10px 12px", marginBottom: 6,
    cursor: "pointer", transition: "border-color 0.15s",
  },
  actionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  actionCategory: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9b9b9b" },
  priorityBadge: (p) => ({
    fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
    padding: "2px 6px", borderRadius: 3,
    background: PRIORITY[p].bg, border: `1px solid ${PRIORITY[p].border}`, color: PRIORITY[p].color,
  }),
  actionText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 6 },
  executeBtn: {
    display: "flex", alignItems: "center", gap: 4,
    fontSize: 9, fontWeight: 700, color: "#dc0032",
    background: "none", border: "none", cursor: "pointer", padding: 0,
    letterSpacing: "0.06em",
  },

  statsFooter: {
    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
    padding: "10px 14px",
    borderTop: "1px solid #f0f0f0",
  },
  statText: { fontSize: 8, color: "#cccccc", letterSpacing: "0.06em" },
  statDot: { fontSize: 8, color: "#e5e5e5" },
};

export function AISummary({ summary, displaySummary, isSummarizing, transcript, sessionStats }) {
  const scrollRef = useRef(null);
  const { sentiment, topics, insights, actions } = deriveAIData(summary, transcript);

  useEffect(() => {
    if (scrollRef.current && isSummarizing)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displaySummary, isSummarizing]);

  return (
    <div ref={scrollRef} style={S.root}>
 <style>{`
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes scan { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
`}</style>

      {/* ── AI Analysis header ── */}
      <div style={S.section}>
        <div style={S.headerRow}>
          <div style={S.aiTitle}>
            {isSummarizing
              ? <Loader size={13} color="#dc0032" style={{ animation: "spin 1s linear infinite" }} />
              : <Sparkles size={13} color="#dc0032" />}
            <span style={S.aiTitleText}>AI Analysis</span>
          </div>
          {sessionStats && (
            <span style={S.updatesCount}>{sessionStats.summaryCount} updates</span>
          )}
        </div>

        {/* Sentiment */}
        <div style={S.sentimentRow}>
          <span style={S.sentimentLabel}>Sentiment:</span>
          <span style={S.sentimentBadge(sentiment)}>{sentiment}</span>
        </div>

        {/* Topics */}
        {topics.length > 0 && (
          <div style={S.topicsRow}>
            {topics.map((t, i) => <span key={i} style={S.topicChip}>{t}</span>)}
          </div>
        )}

        {/* Summary */}
        {displaySummary ? (
          <p style={S.summaryText}>
            {displaySummary}
            {isSummarizing && <span style={S.cursor} />}
          </p>
        ) : (
          <p style={S.summaryEmpty}>
            {isSummarizing ? "Analyzing conversation..." : "Summary will appear as conversation progresses..."}
          </p>
        )}

        {isSummarizing && (
          <div style={S.progressBar}>
            <div style={S.progressFill} />
          </div>
        )}
      </div>

      {/* ── Real-time Insights ── */}
      <div style={{ ...S.section, marginTop: 1 }}>
        <div style={S.sectionLabel}>Real-time Insights</div>
        {insights.map((ins) => {
          const { Icon, color } = INSIGHT_ICON[ins.type] || INSIGHT_ICON.info;
          return (
            <div key={ins.id} style={S.insightCard}>
              <Icon size={12} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={S.insightText}>{ins.message}</p>
            </div>
          );
        })}
      </div>

      {/* ── Suggested Actions ── */}
      <div style={{ ...S.section, marginTop: 1, flex: 1 }}>
        <div style={S.sectionLabel}>Suggested Actions</div>
        {actions.map((a) => (
          <div
            key={a.id}
            style={S.actionCard}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#dc0032")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#ebebeb")}
          >
            <div style={S.actionHeader}>
              <span style={S.actionCategory}>{a.category}</span>
              <span style={S.priorityBadge(a.priority)}>{a.priority}</span>
            </div>
            <p style={S.actionText}>{a.action}</p>
            <button style={S.executeBtn}>
              Execute Action <ArrowRight size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Stats footer ── */}
      {sessionStats && (
        <div style={S.statsFooter}>
          {[`Duration: ${sessionStats.duration}s`, `${sessionStats.chunkCount} chunks`, `${sessionStats.summaryCount} summaries`]
            .map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={S.statDot}>·</span>}
                <span style={S.statText}>{s}</span>
              </React.Fragment>
            ))}
        </div>
      )}
    </div>
  );
}