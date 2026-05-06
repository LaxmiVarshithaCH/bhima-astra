import React from "react";
import { motion } from "framer-motion";
import { formatINR } from "../../utils/currency";
import { useWorker } from "../../context/WorkerContext";
import type { PayoutItem } from "../../services/api";

const mono = { fontFamily: "DM Mono, monospace" } as React.CSSProperties;
const editorial = {
  fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  letterSpacing: "0.02em",
  lineHeight: 1,
} as React.CSSProperties;

// Map trigger_type to display label
const triggerLabel = (type: string | null): string => {
  if (!type) return "Unknown";
  const map: Record<string, string> = {
    rainfall: "Heavy Rainfall",
    rain: "Heavy Rainfall",
    heat: "Extreme Heat",
    aqi: "AQI Spike",
    flood: "Flood Alert",
    curfew: "Civil Curfew",
    strike: "Civil Strike",
    outage: "Platform Outage",
  };
  return (
    map[type.toLowerCase()] ?? type.charAt(0).toUpperCase() + type.slice(1)
  );
};

// Map payout_status to display badge
const statusLabel = (status: string | null): string => {
  if (!status) return "PENDING";
  const s = status.toLowerCase();
  if (s === "paid" || s === "completed" || s === "approved") return "SETTLED";
  if (s === "held" || s === "hold") return "HELD";
  if (s === "processing") return "PROCESSING";
  return status.toUpperCase();
};

const statusColor = (status: string | null): string => {
  const s = statusLabel(status);
  if (s === "SETTLED") return "#22c55e";
  if (s === "HELD") return "#FF5C5C";
  return "#FBBF24";
};

// Format timestamp to readable date
const formatDate = (ts: string | null): string => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return ts;
  }
};

const RecentPayoutsTimeline: React.FC = () => {
  const { payouts, loading } = useWorker();

  // Show most recent 5 payouts that have amounts or are paid
  const display = payouts
    .filter((p: PayoutItem) => p.payout_amount || p.trigger_type)
    .slice(0, 5);

  const totalSettled = display
    .filter((p: PayoutItem) =>
      ["paid", "completed", "approved"].includes(
        (p.payout_status || "").toLowerCase(),
      ),
    )
    .reduce((a: number, p: PayoutItem) => a + (p.payout_amount ?? 0), 0);

  if (loading && !payouts.length) {
    return (
      <div
        style={{
          padding: "28px 30px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#111827",
            marginBottom: 16,
          }}
        >
          Recent Payouts
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 50,
              background: "#f3f4f6",
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
        ))}
      </div>
    );
  }

  if (!display.length) {
    return (
      <motion.div
        style={{
          padding: "28px 30px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.65 }}
      >
        <div
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#111827",
            marginBottom: 16,
          }}
        >
          Recent Payouts
        </div>
        <div
          style={{ textAlign: "center", padding: "32px 0", color: "#6b7280" }}
        >
          <div style={{ ...editorial, fontSize: 20, marginBottom: 8 }}>
            No payouts yet
          </div>
          <div style={{ ...mono, fontSize: 11 }}>
            Payouts appear here once a trigger event fires in your zone.
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{
        padding: "28px 30px",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px -30% 0px" }}
      transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            ...mono,
            fontsize: 12,
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#111827",
          }}
        >
          Recent Payouts
        </div>
        <span
          style={{
            ...mono,
            fontSize: 9,
            color: "#111827",
            textDecoration: "underline",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          View all →
        </span>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative" }}>
        {/* Connecting line */}
        <div
          style={{
            position: "absolute",
            left: 8,
            top: 14,
            bottom: 14,
            width: 1,
            background:
              "linear-gradient(180deg, rgba(34,197,94,0.4), rgba(34,197,94,0.05))",
          }}
        />

        {display.map((p: PayoutItem, i: number) => {
          const color = statusColor(p.payout_status);
          const label = statusLabel(p.payout_status);
          return (
            <motion.div
              key={p.claim_id}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "13px 0",
                borderBottom:
                  i < display.length - 1 ? "1px solid #f3f4f6" : "none",
                position: "relative",
              }}
            >
              {/* Timeline dot */}
              <div
                style={{
                  width: 17,
                  height: 17,
                  flexShrink: 0,
                  border: `1px solid ${color}44`,
                  background: `${color}10`,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                  }}
                />
              </div>

              {/* Date & ID */}
              <div style={{ width: 104, flexShrink: 0 }}>
                <div
                  style={{
                    ...mono,
                    fontSize: 11,
                    color: "#111827",
                    letterSpacing: "0.04em",
                  }}
                >
                  {formatDate(p.claim_timestamp)}
                </div>
                <div
                  style={{
                    ...mono,
                    fontSize: 10,
                    color: "#111827",
                    letterSpacing: "0.04em",
                    marginTop: 1,
                  }}
                >
                  #{p.claim_id}
                </div>
              </div>

              {/* Trigger */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 15,
                    color: "#111827",
                    letterSpacing: "0.02em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {triggerLabel(p.trigger_type)}
                  {p.trigger_level ? ` · ${p.trigger_level}` : ""}
                </div>
              </div>

              {/* Amount */}
              <div
                style={{
                  ...editorial,
                  fontSize: 22,
                  color: "#111827",
                  flexShrink: 0,
                  textAlign: "right",
                }}
              >
                {p.payout_amount ? formatINR(p.payout_amount) : "—"}
              </div>

              {/* Status badge */}
              <div
                className={`badge ${label === "SETTLED" ? "badge-green" : label === "HELD" ? "badge-red" : "badge-amber"}`}
                style={{
                  flexShrink: 0,
                  minWidth: 72,
                  justifyContent: "center",
                }}
              >
                {label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Lifetime total */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#111827",
          }}
        >
          Total Settled · Lifetime
        </span>
        <span style={{ ...editorial, fontSize: 28, color: "#22c55e" }}>
          {formatINR(totalSettled)}
        </span>
      </div>
    </motion.div>
  );
};

export default RecentPayoutsTimeline;
