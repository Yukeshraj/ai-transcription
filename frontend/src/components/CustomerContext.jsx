import React, { useState } from "react";
import {
  Phone, MapPin, CreditCard, Calendar,
  ArrowLeftRight, Building2, ShieldCheck, ShoppingBag,
  Flag, Lock, Send, FileText, TrendingUp, History,
} from "lucide-react";

const MOCK_CUSTOMER = {
  name: "Yukesh Vinayagan",
  initials: "YV",
  accountNumber: "4892-7651-3394",
  phoneNumber: "+1 (416) 555-8234",
  location: "Toronto, ON",
  accountType: "Premium Chequing",
  customerSince: "Mar 2018",
  riskLevel: "low",
  recentTransactions: [
    { date: "May 28, 2026", description: "Interac e-Transfer",       amount: "-$250.00",   credit: false, Icon: ArrowLeftRight },
    { date: "May 27, 2026", description: "Direct Deposit — Payroll", amount: "+$3,847.92", credit: true,  Icon: Building2      },
    { date: "May 26, 2026", description: "TD Insurance",             amount: "-$127.45",   credit: false, Icon: ShieldCheck    },
    { date: "May 25, 2026", description: "Amazon.ca",                amount: "-$89.34",    credit: false, Icon: ShoppingBag    },
  ],
  previousCalls: [
    { date: "May 15, 2026", duration: "12m 34s", topic: "Credit card inquiry",          status: "Resolved"          },
    { date: "Mar 08, 2026", duration: "6m 12s",  topic: "Account balance verification", status: "Resolved"          },
    { date: "Jan 22, 2026", duration: "18m 45s", topic: "Mortgage pre-approval",        status: "Follow-up pending" },
  ],
};

const TABS = ["Transactions", "Call history", "Actions"];

const S = {
  root: {
    display: "flex", flexDirection: "column",
    height: "100%", overflow: "hidden",
    background: "#ffffff",
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
    fontSize: 12,
    color: "#1a1a1a",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    padding: "14px 14px 12px",
    borderBottom: "1px solid #ebebeb",
    flexShrink: 0,
  },
  avatarRow: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: "#1a1a1a", color: "#ffffff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
    flexShrink: 0,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 12, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 },
  acctNum: { fontSize: 9, color: "#aaaaaa", marginTop: 2, letterSpacing: "0.08em" },

  riskBadge: (level) => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "3px 8px", borderRadius: 3,
    background: level === "high" ? "#fff0f0" : "#f0faf4",
    border: `1px solid ${level === "high" ? "#fcc" : "#b2e6c8"}`,
    color: level === "high" ? "#dc0032" : "#15803d",
    flexShrink: 0,
  }),
  riskDot: (level) => ({
    width: 5, height: 5, borderRadius: "50%",
    background: level === "high" ? "#dc0032" : "#16a34a",
  }),

  metaGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 5,
  },
  metaItem: {
    display: "flex", alignItems: "center", gap: 5,
  },
  metaText: { fontSize: 10, color: "#6b6b6b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  // ── Tabs ────────────────────────────────────────────────
  tabBar: {
    display: "flex", borderBottom: "1px solid #ebebeb",
    flexShrink: 0,
  },
  tab: (active) => ({
    flex: 1, padding: "8px 0",
    fontSize: 10, fontWeight: active ? 600 : 400,
    color: active ? "#1a1a1a" : "#aaaaaa",
    background: "none", border: "none",
    borderBottom: `2px solid ${active ? "#1a1a1a" : "transparent"}`,
    cursor: "pointer", letterSpacing: "0.04em",
    transition: "color 0.15s, border-color 0.15s",
    marginBottom: -1,
  }),

  // ── Scrollable body ─────────────────────────────────────
  body: { flex: 1, overflowY: "auto" },

  sectionLabel: {
    fontSize: 8, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.14em", color: "#bbbbbb",
    padding: "10px 14px 6px",
  },

  // Transactions
  txRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 14px",
    borderBottom: "1px solid #f5f5f5",
  },
  txIcon: {
    width: 28, height: 28, borderRadius: 6,
    background: "#f7f7f7",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  txDesc: { fontSize: 11, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  txDate: { fontSize: 9, color: "#bbbbbb", marginTop: 1 },

  // Call history
  callCard: {
    margin: "0 10px 6px",
    padding: "10px 12px",
    border: "1px solid #f0f0f0",
    borderRadius: 6,
    cursor: "pointer",
    transition: "background 0.1s",
  },
  callMeta: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  callMetaText: { fontSize: 9, color: "#bbbbbb" },
  callTopic: { fontSize: 11, color: "#1a1a1a" },
  callStatus: (resolved) => ({
    display: "inline-block", marginTop: 5,
    fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
    padding: "2px 6px", borderRadius: 3,
    background: resolved ? "#f5f5f5" : "#fff8ee",
    border: `1px solid ${resolved ? "#e5e5e5" : "#fcd9a0"}`,
    color: resolved ? "#888888" : "#b45309",
  }),

  // Actions
  actionsGrid: { padding: "6px 10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  btnPrimary: {
    gridColumn: "1 / -1",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 0",
    background: "#1a1a1a", color: "#ffffff",
    border: "none", borderRadius: 6,
    fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  btnSecondary: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    padding: "8px 0",
    background: "#ffffff", color: "#4a4a4a",
    border: "1px solid #e8e8e8", borderRadius: 6,
    fontSize: 10, fontWeight: 500, cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  divider: { height: 1, background: "#f0f0f0", margin: "10px 10px" },
  notesLabel: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#bbbbbb", padding: "0 10px 5px" },
  textarea: {
    width: "100%", boxSizing: "border-box",
    background: "#fafafa", border: "1px solid #ebebeb", borderRadius: 6,
    padding: "8px 10px", fontSize: 10,
    color: "#1a1a1a", resize: "none", outline: "none",
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
    lineHeight: 1.6,
    transition: "border-color 0.15s",
  },
};

export function CustomerContext() {
  const [activeTab, setActiveTab] = useState("Transactions");
  const [notes, setNotes] = useState("");
  const d = MOCK_CUSTOMER;

  return (
    <div style={S.root}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.avatarRow}>
          <div style={S.avatar}>{d.initials}</div>
          <div style={S.nameBlock}>
            <div style={S.name}>{d.name}</div>
            <div style={S.acctNum}>{d.accountNumber}</div>
          </div>
          <div style={S.riskBadge(d.riskLevel)}>
            <div style={S.riskDot(d.riskLevel)} />
            {d.riskLevel === "high" ? "High" : "Low"}
          </div>
        </div>

        <div style={S.metaGrid}>
          {[
            [Phone,      d.phoneNumber],
            [MapPin,     d.location],
            [CreditCard, d.accountType],
            [Calendar,   `Since ${d.customerSince}`],
          ].map(([Icon, text], i) => (
            <div key={i} style={S.metaItem}>
              <Icon size={11} color="#cccccc" style={{ flexShrink: 0 }} />
              <span style={S.metaText}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabBar}>
        {TABS.map((tab) => (
          <button key={tab} style={S.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div style={S.body}>

        {/* Transactions */}
        {activeTab === "Transactions" && (
          <>
            <div style={S.sectionLabel}>Recent activity</div>
            {d.recentTransactions.map((tx, i) => (
              <div key={i} style={S.txRow}>
                <div style={S.txIcon}>
                  <tx.Icon size={13} color="#bbbbbb" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.txDesc}>{tx.description}</div>
                  <div style={S.txDate}>{tx.date}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: tx.credit ? "#15803d" : "#1a1a1a" }}>
                  {tx.amount}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Call history */}
        {activeTab === "Call history" && (
          <>
            <div style={S.sectionLabel}>Previous interactions</div>
            <div style={{ padding: "0 0 10px" }}>
              {d.previousCalls.map((c, i) => (
                <div key={i} style={S.callCard}>
                  <div style={S.callMeta}>
                    <span style={S.callMetaText}>{c.date}</span>
                    <span style={S.callMetaText}>{c.duration}</span>
                  </div>
                  <div style={S.callTopic}>{c.topic}</div>
                  <div style={S.callStatus(c.status === "Resolved")}>{c.status}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        {activeTab === "Actions" && (
          <>
            <div style={S.sectionLabel}>Quick actions</div>
            <div style={S.actionsGrid}>
              <button style={S.btnPrimary}>
                <Flag size={12} /> Flag account
              </button>
              {[
                [Lock,       "Freeze card"],
                [Send,       "Send notice"],
                [FileText,   "Add note"],
                [TrendingUp, "Escalate"],
                [History,    "Full history"],
              ].map(([Icon, label], i) => (
                <button key={i} style={S.btnSecondary}>
                  <Icon size={12} color="#aaaaaa" /> {label}
                </button>
              ))}
            </div>

            <div style={S.divider} />

            <div style={S.notesLabel}>Call notes</div>
            <div style={{ padding: "0 10px 14px" }}>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for this call…"
                style={S.textarea}
                onFocus={(e) => (e.target.style.borderColor = "#1a1a1a")}
                onBlur={(e) => (e.target.style.borderColor = "#ebebeb")}
              />
            </div>
          </>
        )}

      </div>
    </div>
  );
}