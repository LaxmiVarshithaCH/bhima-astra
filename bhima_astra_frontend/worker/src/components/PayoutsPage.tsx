import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getToken } from "../services/api";

/* ─── Types & Interfaces ─── */
interface Transaction {
  id: string;
  event: string;
  level: string;
  date: string;
  time: string;
  status: "Paid" | "Pending" | "Failed" | "Processing";
  amount: number | string;
  icon: string;
  color: string;
  _isNew?: boolean;
  _processingUntil?: number; // epoch ms when processing ends
}

interface Metrics {
  totalRecovered: number;
  pendingPayout: number;
  eventsTriggered: number;
  avgPerEvent: number;
  totalBalance: number;
}

/* ─── Toast type ─── */
interface ToastItem {
  id: string;
  msg: string;
  type: "success" | "error" | "info";
}

/* ─── localStorage keys ─── */
const LS_KEY = "bhima_simulated_payouts";
const LS_PROCESSING = "bhima_processing_payouts"; // ids currently in flight

/* ─── Processing delay window (ms) ─── */
const PROCESSING_DELAY_MS = 9000; // 9 seconds

/* ─── Seed data (Standard plan caps: L1=₹400, L2/HIGH=₹600, L3/CRITICAL=₹800) ─── */
const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: "P-0042",
    event: "Heavy Rainfall",
    level: "HIGH",
    date: "02 Apr 2026",
    time: "09:14 AM",
    status: "Paid",
    amount: 600,
    icon: "🌧️",
    color: "#60A5FA",
  },
  {
    id: "P-0038",
    event: "Civil Curfew",
    level: "CRITICAL",
    date: "14 Mar 2026",
    time: "03:40 PM",
    status: "Paid",
    amount: 800,
    icon: "🚨",
    color: "#A78BFA",
  },
  {
    id: "P-0031",
    event: "Extreme Heat",
    level: "HIGH",
    date: "28 Feb 2026",
    time: "12:22 PM",
    status: "Paid",
    amount: 600,
    icon: "🌡️",
    color: "#FF5C5C",
  },
  {
    id: "P-0024",
    event: "Flood Alert",
    level: "MODERATE",
    date: "11 Feb 2026",
    time: "07:55 AM",
    status: "Pending",
    amount: 400,
    icon: "🌊",
    color: "#00D1B2",
  },
  {
    id: "P-0019",
    event: "Heavy Rainfall",
    level: "HIGH",
    date: "03 Jan 2026",
    time: "06:30 AM",
    status: "Paid",
    amount: 600,
    icon: "🌧️",
    color: "#60A5FA",
  },
];

/* ─── Plan caps for simulation (Standard plan defaults) ─── */
const SIM_PAYOUT_BY_LEVEL: Record<string, number> = {
  MODERATE: 400, // L1
  HIGH: 600,     // L2
  CRITICAL: 800, // L3
};
const SIM_MAX_PAYOUT = 1200; // absolute cap (Premium L3)

/* ─── Helpers ─── */
function computeMetrics(txns: Transaction[]): Metrics {
  const paid = txns.filter((t) => t.status === "Paid");
  const pending = txns.filter(
    (t) => t.status === "Pending" || t.status === "Processing",
  );
  const totalRecovered = paid.reduce((s, t) => s + Number(t.amount), 0);
  const pendingPayout = pending.reduce((s, t) => s + Number(t.amount), 0);
  const eventsTriggered = txns.length;
  const avgPerEvent = eventsTriggered
    ? Math.round(totalRecovered / eventsTriggered)
    : 0;
  const totalBalance = totalRecovered;
  return {
    totalRecovered,
    pendingPayout,
    eventsTriggered,
    avgPerEvent,
    totalBalance,
  };
}

function readStoredPayouts(): Transaction[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate: clamp any previously stored amounts that exceed plan caps
    const clamped = (parsed as Transaction[]).map((t) => ({
      ...t,
      amount: Math.min(Number(t.amount) || 0, SIM_MAX_PAYOUT),
    }));
    return clamped;
  } catch {
    return [];
  }
}

function writeStoredPayouts(txns: Transaction[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(txns));
}

function mergePayouts(
  stored: Transaction[],
  seed: Transaction[],
): Transaction[] {
  const map = new Map<string, Transaction>();
  seed.forEach((t) => map.set(t.id, t));
  stored.forEach((t) => map.set(t.id, t));
  return Array.from(map.values()).sort((a, b) =>
    String(b.id).localeCompare(String(a.id), undefined, { numeric: true }),
  );
}

function nowDateStr() {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function nowTimeStr() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function uid() {
  return `P-${Date.now().toString().slice(-6)}`;
}

/* ─── Styling helpers ─── */
const mono = (size = 11): React.CSSProperties => ({
  fontFamily: "DM Mono, monospace",
  fontSize: size,
  letterSpacing: "0.12em",
});
const editorial = (size = 36): React.CSSProperties => ({
  fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  fontSize: size,
  letterSpacing: "0.03em",
  lineHeight: 1,
});
const formatCurrency = (val: number | string) => {
  const n =
    typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : val;
  if (isNaN(n)) return String(val);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
};

/* ─── ScrollReveal hook ─── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          obs.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -30% 0px", threshold: 0.05 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const Section: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, style }) => {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className="section-reveal"
      style={{ transitionDelay: `${delay}s`, marginBottom: 40, ...style }}
    >
      {children}
    </div>
  );
};

/* ─── Processing Progress Bar sub-component ─── */
const ProcessingBar: React.FC<{ processingUntil: number; color: string }> = ({
  processingUntil,
  color,
}) => {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const total = PROCESSING_DELAY_MS;
    const start = processingUntil - total;
    const tick = () => {
      const elapsed = Date.now() - start;
      setPct(Math.min(100, Math.round((elapsed / total) * 100)));
    };
    tick();
    const iv = setInterval(tick, 80);
    return () => clearInterval(iv);
  }, [processingUntil]);

  return (
    <div style={{ marginTop: 8, width: "100%" }}>
      {/* label row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            ...mono(10),
            color: "#d97706",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animation: "spin 1.2s linear infinite" }}
          >
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Processing payout…
        </span>
        <span style={{ ...mono(10), color: "#d97706" }}>{pct}%</span>
      </div>
      {/* track */}
      <div
        style={{
          height: 5,
          background: "rgba(217,119,6,0.12)",
          borderRadius: 4,
          overflow: "hidden",
          width: "100%",
        }}
      >
        <motion.div
          style={{
            height: "100%",
            borderRadius: 4,
            background: `linear-gradient(90deg, ${color}, #d97706, #fbbf24)`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ ease: "linear", duration: 0.1 }}
        />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   UPI BOTTOM-SHEET PAYMENT OVERLAY  (Razorpay / PhonePe style)
   Phase 1 → "processing"  : dim backdrop + bottom sheet slides up
   Phase 2 → "morphing"    : sheet expands radially, bg turns green
   Phase 3 → "success"     : full-screen green + checkmark + amount
═══════════════════════════════════════════════════════════════ */
interface SuccessPayload {
  amount: number | string;
  event: string;
  id: string;
}
type OverlayPhase = "processing" | "morphing" | "success";
interface OverlayState {
  phase: OverlayPhase;
  payload: SuccessPayload;
}

/* ── tiny dot-pulse loader ── */
const DotPulse: React.FC = () => (
  <div
    style={{
      display: "flex",
      gap: 6,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{
          duration: 0.8,
          delay: i * 0.15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#3b82f6",
        }}
      />
    ))}
  </div>
);

/* ── UPI-style bottom sheet (processing phase) ── */
const BottomSheet: React.FC<{
  payload: SuccessPayload;
  processingUntil: number;
}> = ({ payload, processingUntil }) => {
  const [pct, setPct] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  const steps = [
    { label: "Verifying event conditions", icon: "🔍" },
    { label: "Authenticating worker", icon: "👤" },
    { label: "Initiating UPI transfer", icon: "📡" },
    { label: "Confirming with network", icon: "✅" },
  ];

  useEffect(() => {
    const total = PROCESSING_DELAY_MS;
    const start = processingUntil - total;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(99, Math.round((elapsed / total) * 100));
      setPct(p);
      setStepIdx(
        Math.min(steps.length - 1, Math.floor((p / 100) * steps.length)),
      );
    };
    tick();
    const iv = setInterval(tick, 90);
    return () => clearInterval(iv);
  }, [processingUntil]);

  return (
    <>
      {/* dim backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99980,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* bottom sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 34, mass: 0.9 }}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99990,
          background: "#ffffff",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding:
            "clamp(24px,5vw,36px) clamp(20px,5vw,36px) clamp(32px,6vw,48px)",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.25)",
          overflowX: "hidden",
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "#e5e7eb",
            margin: "0 auto 28px",
          }}
        />

        {/* header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 13,
                color: "#6b7280",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Bhima Protocol · UPI
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue','Barlow Condensed',sans-serif",
                fontSize: "clamp(22px,5vw,30px)",
                color: "#111827",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              Processing your payment
            </div>
          </div>
          {/* shield icon */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>

        {/* amount chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "18px 20px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(96,165,250,0.1))",
              border: "1px solid rgba(59,130,246,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 22 }}>
              {payload.event.includes("Rain")
                ? "🌧️"
                : payload.event.includes("Heat")
                  ? "🌡️"
                  : payload.event.includes("Flood")
                    ? "🌊"
                    : payload.event.includes("AQI")
                      ? "🌫️"
                      : "🚨"}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#6b7280",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              {payload.event}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue','Barlow Condensed',sans-serif",
                fontSize: "clamp(28px,6vw,40px)",
                color: "#111827",
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              {formatCurrency(payload.amount)}
            </div>
          </div>
          <DotPulse />
        </div>

        {/* progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#6b7280",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Transfer progress
            </span>
            <span
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#3b82f6",
              }}
            >
              {pct}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "#f3f4f6",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                height: "100%",
                borderRadius: 3,
                background: "linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: `${pct}%` }}
              transition={{ ease: "linear", duration: 0.1 }}
            />
          </div>
        </div>

        {/* step list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            const future = i > stepIdx;
            return (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom:
                    i < steps.length - 1 ? "1px solid #f3f4f6" : "none",
                  opacity: future ? 0.35 : 1,
                  transition: "opacity 0.4s",
                }}
              >
                {/* state dot */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: done
                      ? "#3b82f6"
                      : active
                        ? "rgba(59,130,246,0.12)"
                        : "#f3f4f6",
                    border: `1.5px solid ${done ? "#3b82f6" : active ? "rgba(59,130,246,0.5)" : "#e5e7eb"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.4s",
                  }}
                >
                  {done && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {active && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#3b82f6",
                      }}
                    />
                  )}
                  {future && <span style={{ fontSize: 12 }}>{s.icon}</span>}
                </div>
                <span
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 13,
                    color: done ? "#6b7280" : active ? "#111827" : "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: active ? 700 : 400,
                    flex: 1,
                    lineHeight: 1.4,
                  }}
                >
                  {s.label}
                </span>
                {done && <span style={{ fontSize: 13 }}>✓</span>}
                {active && (
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 11,
                      color: "#3b82f6",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Live
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* bottom note */}
        <div
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          🔒 Secured · Do not close this screen
        </div>
      </motion.div>
    </>
  );
};

/* ── Morphing transition + full-screen success ── */
const SuccessScreen: React.FC<{
  payload: SuccessPayload;
  onDone: () => void;
}> = ({ payload, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      key="success-fs"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(160deg, #0f172a 0%, #1e3a8a 45%, #0f172a 100%)",
        overflowX: "hidden",
      }}
      onClick={onDone}
    >
      {/* radial burst */}
      <motion.div
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(96,165,250,0.5) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* top complete bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 4,
          width: "100%",
          transformOrigin: "left",
          background: "linear-gradient(90deg, #2563eb, #60a5fa)",
          boxShadow: "0 0 20px rgba(96,165,250,0.8)",
        }}
      />

      {/* confetti */}
      {[...Array(20)].map((_, i) => {
        const angle = (i / 20) * 360;
        const dist = 100 + (i % 5) * 36;
        const size = 5 + (i % 5) * 2;
        const colors = [
          "#3b82f6",
          "#60a5fa",
          "#93c5fd",
          "#c084fc",
          "#dbeafe",
          "#818cf8",
          "#fef08a",
          "#fff",
        ];
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: dist * Math.cos((angle * Math.PI) / 180),
              y: dist * Math.sin((angle * Math.PI) / 180),
              scale: [0, 1.4, 0.7],
              opacity: [1, 1, 0],
            }}
            transition={{
              delay: 0.15 + (i % 5) * 0.05,
              duration: 1.1,
              ease: "easeOut",
            }}
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: i % 3 === 0 ? "50%" : i % 3 === 1 ? 2 : "20%",
              background: colors[i % colors.length],
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* content card */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 24,
          delay: 0.08,
        }}
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          padding: "0 clamp(20px, 5vw, 40px)",
          width: "100%",
          maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* checkmark circle */}
        <div
          style={{
            position: "relative",
            width: 120,
            height: 120,
            margin: "0 auto 32px",
          }}
        >
          {[1, 2].map((r) => (
            <motion.div
              key={r}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ delay: 0.08 * r, duration: 1.1, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid rgba(96,165,250,0.6)",
                pointerEvents: "none",
              }}
            />
          ))}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 20,
              delay: 0.1,
            }}
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, #60a5fa 0%, #2563eb 55%, #0f172a 100%)",
              boxShadow:
                "0 0 0 14px rgba(59,130,246,0.15), 0 0 70px rgba(59,130,246,0.55), 0 0 130px rgba(59,130,246,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.polyline
                points="20 6 9 17 4 12"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  delay: 0.28,
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </motion.svg>
          </motion.div>
        </div>

        {/* amount */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.38, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: "'Bebas Neue','Barlow Condensed',sans-serif",
            fontSize: "clamp(56px,12vw,88px)",
            letterSpacing: "0.01em",
            lineHeight: 1,
            color: "#60a5fa",
            marginBottom: 10,
            textShadow:
              "0 0 48px rgba(96,165,250,0.8), 0 0 90px rgba(59,130,246,0.35)",
          }}
        >
          {formatCurrency(payload.amount)}
        </motion.div>

        {/* "Payment Successful" */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.45 }}
          style={{
            fontFamily: "'Bebas Neue','Barlow Condensed',sans-serif",
            fontSize: "clamp(22px,5vw,32px)",
            letterSpacing: "0.08em",
            color: "#dbeafe",
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          Payment Successful
        </motion.div>

        {/* credited line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 13,
            letterSpacing: "0.14em",
            color: "rgba(147,197,253,0.7)",
            textTransform: "uppercase",
            marginBottom: 30,
          }}
        >
          Credited to UPI · {payload.id}
        </motion.div>

        {/* event chip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.68, duration: 0.4 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(96,165,250,0.25)",
            borderRadius: 14,
            padding: "12px 22px",
          }}
        >
          <span style={{ fontSize: 22 }}>
            {payload.event.includes("Rain")
              ? "🌧️"
              : payload.event.includes("Heat")
                ? "🌡️"
                : payload.event.includes("Flood")
                  ? "🌊"
                  : payload.event.includes("AQI")
                    ? "🌫️"
                    : "🚨"}
          </span>
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "rgba(147,197,253,0.5)",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Trigger Event
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue','Barlow Condensed',sans-serif",
                fontSize: 20,
                color: "#93c5fd",
                letterSpacing: "0.06em",
              }}
            >
              {payload.event}
            </div>
          </div>
        </motion.div>

        {/* tap hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          style={{
            fontFamily: "DM Mono, monospace",
            fontsize: 10,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.18)",
            textTransform: "uppercase",
            marginTop: 32,
          }}
        >
          Tap anywhere to continue
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

/* ── Morph bridge: sheet → fullscreen green ── */
const MorphTransition: React.FC = () => (
  <motion.div
    key="morph"
    initial={{
      clipPath: "inset(60% 0% 0% 0% round 28px 28px 0 0)",
      background: "#ffffff",
    }}
    animate={{
      clipPath: "inset(0% 0% 0% 0% round 0px)",
      background: "#0f172a",
    }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    style={{ position: "fixed", inset: 0, zIndex: 99995 }}
  />
);

/* ── Orchestrator ── */
const PaymentOverlay: React.FC<{
  state: OverlayState;
  processingUntil: number;
  onDone: () => void;
}> = ({ state, processingUntil, onDone }) => (
  <AnimatePresence mode="wait">
    {state.phase === "processing" && (
      <BottomSheet
        key="bs"
        payload={state.payload}
        processingUntil={processingUntil}
      />
    )}
    {state.phase === "morphing" && <MorphTransition key="morph" />}
    {state.phase === "success" && (
      <SuccessScreen key="succ" payload={state.payload} onDone={onDone} />
    )}
  </AnimatePresence>
);

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
const PayoutsPage: React.FC = () => {
  const navigate = useNavigate();

  /* ── Core state ── */
  const [metrics, setMetrics] = useState<Metrics>({
    totalRecovered: 0,
    pendingPayout: 0,
    eventsTriggered: 0,
    avgPerEvent: 0,
    totalBalance: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  /* ── Filter state ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /* ── Interaction state ── */
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [overlayState, setOverlayState] = useState<OverlayState | null>(null);
  const [overlayProcessingUntil, setOverlayProcUntil] = useState(0);

  /* ── Refs ── */
  const prevCountRef = useRef(0);
  const processingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  /* ── Toast helpers ── */
  const addToast = useCallback(
    (msg: string, type: ToastItem["type"] = "info") => {
      const id = `t-${Date.now()}`;
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        5000,
      );
    },
    [],
  );

  /* ── Promote a processing payout to Paid after delay ── */
  const schedulePromotion = useCallback(
    (txn: Transaction, processingUntil: number) => {
      // Don't double-schedule
      if (processingTimers.current.has(txn.id)) return;

      const remaining = processingUntil - Date.now();
      const delay = Math.max(0, remaining);

      const timer = setTimeout(() => {
        processingTimers.current.delete(txn.id);

        // Flip status to Paid in localStorage
        const stored = readStoredPayouts();
        const updated = stored.map((t) =>
          t.id === txn.id
            ? { ...t, status: "Paid" as const, _processingUntil: undefined }
            : t,
        );
        writeStoredPayouts(updated);

        // Update local state immediately
        setTransactions((prev) => {
          const next = prev.map((t) =>
            t.id === txn.id
              ? { ...t, status: "Paid" as const, _processingUntil: undefined }
              : t,
          );
          setMetrics(computeMetrics(next));
          return next;
        });

        // Transition overlay from Processing → Morphing → Success
        setOverlayState({
          phase: "morphing",
          payload: { amount: txn.amount, event: txn.event, id: txn.id },
        });
        setTimeout(() => {
          setOverlayState({
            phase: "success",
            payload: { amount: txn.amount, event: txn.event, id: txn.id },
          });
        }, 550);

        // Highlight row in list
        setNewIds((prev) => new Set([...prev, txn.id]));
        setTimeout(
          () =>
            setNewIds((prev) => {
              const s = new Set(prev);
              s.delete(txn.id);
              return s;
            }),
          4500,
        );

        // Fallback toast after overlay closes
        setTimeout(
          () =>
            addToast(
              `✅  ${formatCurrency(txn.amount)} credited — ${txn.event}`,
              "success",
            ),
          3600,
        );
      }, delay);

      processingTimers.current.set(txn.id, timer);
    },
    [addToast],
  );

  /* ── Load & sync payouts ── */
  const loadPayouts = useCallback(
    (isInitial = false) => {
      const stored = readStoredPayouts();
      const merged = mergePayouts(stored, SEED_TRANSACTIONS);

      // Detect new entries
      if (!isInitial && merged.length > prevCountRef.current) {
        const addedIds = merged
          .slice(0, merged.length - prevCountRef.current)
          .map((t) => t.id);
        setNewIds((prev) => new Set([...prev, ...addedIds]));
        setTimeout(
          () =>
            setNewIds((prev) => {
              const s = new Set(prev);
              addedIds.forEach((id) => s.delete(id));
              return s;
            }),
          4500,
        );
      }
      prevCountRef.current = merged.length;

      // Re-schedule any in-flight promotions found in stored data
      merged.forEach((t) => {
        if (t.status === "Processing" && t._processingUntil) {
          schedulePromotion(t, t._processingUntil);
        }
      });

      setTransactions(merged);
      setMetrics(computeMetrics(merged));

      if (isInitial) {
        const BASE_URL =
          (import.meta as { env: Record<string, string> }).env
            .VITE_API_BASE_URL || "http://localhost:8000";
        const token = getToken();

        fetch(`${BASE_URL}/workers/me/payouts`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
          .then(async (res) => {
            if (!res.ok) throw new Error("non-ok");
            const apiData = await res.json();

            // Map backend PayoutItem[] → Transaction[]
            const triggerLabelMap: Record<string, string> = {
              rainfall: "Heavy Rainfall",
              rain: "Heavy Rainfall",
              heat: "Extreme Heat",
              aqi: "AQI Spike",
              flood: "Flood Alert",
              curfew: "Civil Curfew",
              strike: "Civil Strike",
              outage: "Platform Outage",
            };
            const iconMap: Record<string, string> = {
              rainfall: "🌧️",
              rain: "🌧️",
              heat: "🌡️",
              aqi: "💨",
              flood: "🌊",
              curfew: "🚨",
              strike: "⚠️",
              outage: "📡",
            };
            const colorMap: Record<string, string> = {
              rainfall: "#60A5FA",
              rain: "#60A5FA",
              heat: "#FF5C5C",
              aqi: "#FBBF24",
              flood: "#00D1B2",
              curfew: "#A78BFA",
              strike: "#A78BFA",
              outage: "#6b7280",
            };
            const statusMap: Record<string, Transaction["status"]> = {
              paid: "Paid",
              completed: "Paid",
              approved: "Paid",
              pending: "Pending",
              processing: "Processing",
              held: "Pending",
              failed: "Failed",
            };

            const apiTxns: Transaction[] = (
              apiData as Record<string, unknown>[]
            )
              .filter((p) => p.payout_amount || p.trigger_type)
              .map((p) => {
                const ts = p.claim_timestamp
                  ? new Date(p.claim_timestamp as string)
                  : null;
                const t = ((p.trigger_type as string) || "").toLowerCase();
                return {
                  id: `P-${p.claim_id}`,
                  event:
                    triggerLabelMap[t] ||
                    (p.trigger_type as string) ||
                    "Unknown",
                  level: (p.trigger_level as string) || "—",
                  date: ts
                    ? ts.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—",
                  time: ts
                    ? ts.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—",
                  status:
                    statusMap[
                      ((p.payout_status as string) || "").toLowerCase()
                    ] || "Pending",
                  amount: (p.payout_amount as number) || 0,
                  icon: iconMap[t] || "📦",
                  color: colorMap[t] || "#6b7280",
                };
              });

            if (apiTxns.length > 0) {
              const combined = mergePayouts(apiTxns, SEED_TRANSACTIONS);
              setTransactions(combined);
              setMetrics(computeMetrics(combined));
              prevCountRef.current = combined.length;
            }
          })
          .catch(() => {
            /* offline — seed data already set */
          })
          .finally(() => setLoading(false));
      }
    },
    [schedulePromotion],
  );

  /* ── Initial load ── */
  useEffect(() => {
    loadPayouts(true);
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [loadPayouts]);

  /* ── Auto-refresh every 5 s ── */
  useEffect(() => {
    const iv = setInterval(() => loadPayouts(false), 5000);
    return () => clearInterval(iv);
  }, [loadPayouts]);

  /* ── Cross-tab storage events ── */
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY) loadPayouts(false);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [loadPayouts]);

  /* ── Cleanup timers on unmount ── */
  useEffect(() => {
    return () => {
      processingTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  /* ── SIMULATE TRIGGER (demo button) ── */
  const simulateTrigger = useCallback(() => {
    const templates = [
      {
        event: "Heavy Rainfall",
        level: "HIGH",
        icon: "🌧️",
        color: "#60A5FA",
        amount: SIM_PAYOUT_BY_LEVEL["HIGH"],
      },
      {
        event: "Extreme Heat",
        level: "HIGH",
        icon: "🌡️",
        color: "#FF5C5C",
        amount: SIM_PAYOUT_BY_LEVEL["HIGH"],
      },
      {
        event: "AQI Hazard",
        level: "MODERATE",
        icon: "🌫️",
        color: "#FBBF24",
        amount: SIM_PAYOUT_BY_LEVEL["MODERATE"],
      },
      {
        event: "Flood Alert",
        level: "MODERATE",
        icon: "🌊",
        color: "#00D1B2",
        amount: SIM_PAYOUT_BY_LEVEL["MODERATE"],
      },
      {
        event: "Civil Disruption",
        level: "CRITICAL",
        icon: "🚨",
        color: "#A78BFA",
        amount: SIM_PAYOUT_BY_LEVEL["CRITICAL"],
      },
    ];
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    const id = uid();
    const processingUntil = Date.now() + PROCESSING_DELAY_MS;

    const newTxn: Transaction = {
      id,
      event: tpl.event,
      level: tpl.level,
      date: nowDateStr(),
      time: nowTimeStr(),
      status: "Processing",
      amount: tpl.amount,
      icon: tpl.icon,
      color: tpl.color,
      _isNew: true,
      _processingUntil: processingUntil,
    };

    // Step 1: Add to localStorage as Processing
    const stored = readStoredPayouts();
    writeStoredPayouts([newTxn, ...stored]);

    // Step 2: Update local state immediately with Processing row
    setTransactions((prev) => {
      const next = [newTxn, ...prev];
      setMetrics(computeMetrics(next));
      return next;
    });

    prevCountRef.current += 1;

    // Step 3: Show full-screen processing overlay immediately
    setOverlayState({
      phase: "processing",
      payload: { amount: tpl.amount, event: tpl.event, id },
    });
    setOverlayProcUntil(processingUntil);

    // Step 4: Schedule promotion to Paid after delay
    schedulePromotion(newTxn, processingUntil);
  }, [addToast, schedulePromotion]);

  /* ── Filter ── */
  const filteredTransactions = transactions.filter((t) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      String(t.id).toLowerCase().includes(query) ||
      String(t.event).toLowerCase().includes(query);
    const matchType =
      activeFilter === "All" ||
      String(t.event).toLowerCase().includes(activeFilter.toLowerCase());
    const matchStatus =
      statusFilter === "All" ||
      String(t.status).toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchType && matchStatus;
  });

  /* ── Export CSV ── */
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const header = [
      "ID",
      "Event",
      "Severity",
      "Date",
      "Time",
      "Amount",
      "Status",
    ];
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.event,
      t.level,
      t.date,
      t.time,
      String(t.amount).replace("₹", ""),
      t.status,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "payouts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Withdraw ── */
  const handleWithdraw = async () => {
    if (metrics.totalBalance <= 0) {
      addToast("Insufficient balance to withdraw.", "error");
      return;
    }
    setWithdrawLoading(true);
    try {
      const API_URL =
        (import.meta as { env: Record<string, string> }).env
          .VITE_API_BASE_URL || "";
      const res = await fetch(`${API_URL}/api/v1/workers/me/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: metrics.totalBalance, method: "upi" }),
      });
      if (!res.ok) throw new Error("failed");
      setMetrics((prev) => ({ ...prev, totalBalance: 0 }));
      addToast(
        `✅  Successfully withdrew ${formatCurrency(metrics.totalBalance)} to UPI.`,
        "success",
      );
    } catch {
      setMetrics((prev) => ({ ...prev, totalBalance: 0 }));
      addToast(
        `✅  Withdrawn ${formatCurrency(metrics.totalBalance)} to UPI (simulated).`,
        "success",
      );
    } finally {
      setWithdrawLoading(false);
    }
  };

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div
      className="payouts-page-wrap"
      style={{
        width: "100%",
        maxWidth: "none",
        minHeight: "100vh",
        padding: "40px 32px 0",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{`
      .badge {
  font-family: 'DM Mono', monospace;
  font-size: 14px;              /* bigger text */
  padding: 8px 14px;            /* bigger size */
  border-radius: 999px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  opacity: 1 !important;        /* force fully opaque */
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.badge-green {
  background: #dcfce7;
  color: #166534;
  border-color: #22c55e;
}

.badge-blue {
  background: #dbeafe;
  color: #1e40af;
  border-color: #3b82f6;
}

.badge-amber {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }

        @keyframes payoutGlow {
          0%   { box-shadow: 0 0 0 0 rgba(0,209,178,0.55), 0 2px 12px rgba(0,209,178,0.25); background: rgba(0,209,178,0.08); }
          60%  { box-shadow: 0 0 0 7px rgba(0,209,178,0.16), 0 4px 24px rgba(0,209,178,0.18); background: rgba(0,209,178,0.05); }
          100% { box-shadow: none; background: transparent; }
        }
        .payout-new-highlight { animation: payoutGlow 3s ease forwards; }

        @keyframes processingPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.30), 0 2px 8px rgba(217,119,6,0.12); border-color: rgba(217,119,6,0.30); }
          50%      { box-shadow: 0 0 0 5px rgba(217,119,6,0.10), 0 4px 16px rgba(217,119,6,0.16); border-color: rgba(217,119,6,0.50); }
        }
        .payout-processing-row { animation: processingPulse 2.2s ease-in-out infinite; }

        @keyframes toastSlideIn { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }

        @media (max-width: 1200px) {
          .payouts-page-wrap { padding: 24px 24px 0 !important; }
          .payouts-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 768px) {
          .payouts-page-wrap { padding: 16px 16px 0 !important; }
          .payouts-header-row { flex-direction:column !important; align-items:flex-start !important; gap:16px !important; }
          .payouts-header-row > div:last-child { width:100%; display: flex; flex-direction: column; gap: 8px; }
          .payouts-header-row > div:last-child button { width: 100%; justify-content: center; flex: none; }
          .payouts-stats-grid { grid-template-columns: repeat(2,1fr) !important; gap:12px !important; }
          .pcard { padding: 16px 20px !important; }
          .payouts-balance-card { flex-direction:column !important; align-items:flex-start !important; gap:20px !important; padding: 20px !important; }
          .payouts-balance-right { align-items:flex-start !important; width:100%; }
          .payouts-balance-right button { width: 100%; justify-content: center; }
          .payouts-filter-row { flex-direction:column !important; align-items:flex-start !important; gap:12px !important; }
          .payouts-filter-row > div:first-child { max-width:100% !important; width:100% !important; }
          .payouts-filter-row > div:last-child { flex-wrap: wrap; width: 100%; justify-content: flex-start; }
          .payouts-list-header { display:none !important; }
          .payouts-list-item { grid-template-columns:auto 1fr !important; gap:12px !important; padding:16px !important; }
          .payouts-col-severity,.payouts-col-date { display:none !important; }
          .payouts-col-amount { text-align:left !important; }
          .payouts-col-status { text-align:left !important; }
          .payouts-item-mobile-row { display:flex !important; }
        }
        @media (max-width: 480px) {
          .payouts-stats-grid { grid-template-columns: 1fr !important; }
          .payouts-header-row h1 { font-size: clamp(28px, 8vw, 36px) !important; }
        }
      `}</style>

      {/* ── Razorpay-style Payment Overlay (Processing → Success) ── */}
      {overlayState && (
        <PaymentOverlay
          state={overlayState}
          processingUntil={overlayProcessingUntil}
          onDone={() => setOverlayState(null)}
        />
      )}

      {/* ── Toast Stack ── */}
      <div
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          pointerEvents: "none",
          minWidth: 320,
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background:
                  t.type === "success"
                    ? "#22c55e"
                    : t.type === "error"
                      ? "#FF5C5C"
                      : "#d97706",
                color: "#fff",
                padding: "11px 22px",
                borderRadius: 8,
                ...mono(11),
                fontWeight: 700,
                letterSpacing: "0.04em",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                pointerEvents: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Section 1 — Page Header ── */}
      <Section>
        <div
          className="payouts-header-row"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                ...editorial(56),
                color: "#111827",
                lineHeight: 1,
                fontSize: "clamp(32px,5vw,56px)",
              }}
            >
              Vault &amp; <span style={{ color: "#00D1B2" }}>Payouts</span>
            </h1>
            <div
              style={{
                ...mono(14),
                color: "#111827",
                marginTop: 8,
                letterSpacing: "0.12em",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Secured earnings and protected balances
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  ...mono(12),
                  color: "#00D1B2",
                  background: "rgba(0,209,178,1)",
                  border: "1px solid rgba(0,209,178,0.2)",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#00D1B2",
                    display: "inline-block",
                  }}
                />
                LIVE
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* ── Demo Trigger Button ── */}
            <motion.button
              className="btn-outline btn-sliding-lines"
              onClick={simulateTrigger}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#d97706",
                borderColor: "rgba(217,119,6,0.4)",
                fontSize: "16px",
                padding: "12px 20px",
              }}
            >
              <svg
                fontSize="12"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Simulate Trigger
            </motion.button>
            <button
              className="btn-outline btn-sliding-lines"
              onClick={handleExportCSV}
              style={{ fontSize: "16px", padding: "12px 20px" }}
            >
              Export CSV
            </button>
            <button
              className="btn-primary btn-sliding-lines"
              onClick={() => navigate("/policy")}
              style={{
                fontSize: "16px",
                padding: "12px 20px",
                color: "#ffffff",
              }}
            >
              Policy
            </button>
          </div>
        </div>
      </Section>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "100px 0",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid rgba(0,209,178,0.2)",
              borderTopColor: "#00D1B2",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      ) : (
        <>
          {/* ── Section 2 — Stats Cards ── */}
          <Section delay={0.05}>
            <div
              className="payouts-stats-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 20,
              }}
            >
              {[
                {
                  label: "Total Recovered",
                  value: formatCurrency(metrics.totalRecovered),
                  color: "#16a34a",
                },
                {
                  label: "Pending Payout",
                  value: formatCurrency(metrics.pendingPayout),
                  color: "#d97706",
                },
                {
                  label: "Events Triggered",
                  value: String(metrics.eventsTriggered),
                  color: "#3b82f6",
                },
                {
                  label: "Avg Per Event",
                  value: formatCurrency(metrics.avgPerEvent),
                  color: "#111827",
                },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  layout
                  className="pcard hover-shine-effect"
                  style={{ padding: "24px 28px" }}
                >
                  <div
                    style={{
                      ...mono(11),
                      textTransform: "uppercase",
                      color: "#111827",
                      marginBottom: 12,
                      letterSpacing: "0.16em",
                    }}
                  >
                    {stat.label}
                  </div>
                  <motion.div
                    key={stat.value}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ ...editorial(48), color: stat.color }}
                  >
                    {stat.value}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* ── Section 3 — Balance Hero ── */}
          <Section delay={0.08}>
            <div
              className="pcard pcard-teal hover-shine-effect payouts-balance-card"
              style={{
                padding: "36px 40px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 30,
                background:
                  "linear-gradient(135deg,rgba(0,209,178,0.1),#f9fafb)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: "rgba(0,209,178,0.1)",
                    border: "1px solid rgba(0,209,178,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00D1B2"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                    <path d="M7 15h.01" />
                    <path d="M11 15h2" />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      ...mono(10),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      marginBottom: 4,
                    }}
                  >
                    Total Protected Balance
                  </div>
                  <motion.div
                    key={metrics.totalBalance}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      ...editorial(56),
                      color: "#111827",
                      lineHeight: 1,
                    }}
                  >
                    {formatCurrency(metrics.totalBalance)}
                  </motion.div>
                </div>
              </div>

              <div
                className="payouts-balance-right"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 12,
                }}
              >
                <div className="badge badge-green">
                  <div
                    className="pulse-dot"
                    style={{
                      width: 6,
                      height: 6,
                      background: "currentColor",
                      borderRadius: "50%",
                    }}
                  />
                  Available to Withdraw
                </div>
                <motion.button
                  onClick={handleWithdraw}
                  disabled={withdrawLoading || metrics.totalBalance <= 0}
                  className="btn-primary btn-sliding-lines"
                  whileHover={{
                    scale:
                      withdrawLoading || metrics.totalBalance <= 0 ? 1 : 1.03,
                  }}
                  whileTap={{
                    scale:
                      withdrawLoading || metrics.totalBalance <= 0 ? 1 : 0.97,
                  }}
                  style={{
                    background:
                      "linear-gradient(135deg,rgba(0,209,178,0.2),rgba(96,165,250,0.2))",
                    borderColor: "rgba(0,209,178,0.4)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity:
                      withdrawLoading || metrics.totalBalance <= 0 ? 0.6 : 1,
                    cursor:
                      withdrawLoading || metrics.totalBalance <= 0
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "16px",
                    padding: "12px 20px",
                  }}
                >
                  {withdrawLoading && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {withdrawLoading ? "Processing..." : "Withdraw to UPI →"}
                </motion.button>
              </div>
            </div>
          </Section>

          {/* ── Section 4 — Search + Filters ── */}
          <Section delay={0.11}>
            <div
              className="payouts-filter-row"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 24,
                width: "100%",
              }}
            >
              {/* Search */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  flex: "1",
                  minWidth: 260,
                  maxWidth: 360,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID or event..."
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#111827",
                    outline: "none",
                    width: "100%",
                    ...mono(11),
                  }}
                />
              </div>

              {/* Type filter chips */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {["All", "Rain", "AQI", "Heat", "Traffic"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    style={{
                      ...mono(11),
                      padding: "6px 14px",
                      borderRadius: 999,
                      background:
                        activeFilter === f ? "#f3f4f6" : "transparent",
                      border: `1px solid ${activeFilter === f ? "#d1d5db" : "#e5e7eb"}`,
                      color: "#111827",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textTransform: "uppercase",
                    }}
                  >
                    {f}
                  </button>
                ))}

                <div
                  style={{
                    width: 1,
                    height: 20,
                    background: "#e5e7eb",
                    margin: "0 4px",
                  }}
                />

                {/* Status dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{
                      ...mono(10),
                      padding: "6px 14px",
                      background: "transparent",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      color: "#111827",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    {statusFilter === "All" ? "All Status" : statusFilter}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{
                        transform: dropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        marginTop: 4,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        overflow: "hidden",
                        zIndex: 10,
                      }}
                    >
                      {["All", "Paid", "Pending", "Processing", "Failed"].map(
                        (st) => (
                          <div
                            key={st}
                            onClick={() => {
                              setStatusFilter(st);
                              setDropdownOpen(false);
                            }}
                            style={{
                              padding: "10px 16px",
                              ...mono(10),
                              color: "#111827",
                              cursor: "pointer",
                              background:
                                statusFilter === st ? "#f3f4f6" : "transparent",
                              textTransform: "uppercase",
                            }}
                          >
                            {st}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 5 — Payout List ── */}
          <Section delay={0.14}>
            {filteredTransactions.length === 0 ? (
              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  border: "1px dashed #d1d5db",
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>
                  📉
                </div>
                <div
                  style={{
                    ...mono(10),
                    color: "#111827",
                    letterSpacing: "0.1em",
                  }}
                >
                  No transactions found
                </div>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* Header */}
                <div
                  className="payouts-list-header"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "0.6fr 2fr 1fr 1.5fr 1fr 1fr",
                    gap: 16,
                    padding: "0 24px 10px",
                    borderBottom: "1px solid #e5e7eb",
                    alignItems: "center",
                  }}
                >
                  <span />
                  <span
                    style={{
                      ...mono(12),
                      color: "#111827",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    Event Details
                  </span>
                  <span
                    style={{
                      ...mono(12),
                      color: "#111827",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    Severity
                  </span>
                  <span
                    style={{
                      ...mono(12),
                      color: "#111827",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    Date &amp; Ref
                  </span>
                  <span
                    style={{
                      ...mono(12),
                      color: "#111827",
                      textTransform: "uppercase",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    Amount
                  </span>
                  <span
                    style={{
                      ...mono(12),
                      color: "#111827",
                      textTransform: "uppercase",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    Status
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {filteredTransactions.map((p) => {
                    const isNew = newIds.has(p.id);
                    const isProcessing = p.status === "Processing";

                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: -20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{
                          duration: 0.38,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className={[
                          "pcard hover-shine-effect payouts-list-item",
                          isNew ? "payout-new-highlight" : "",
                          isProcessing ? "payout-processing-row" : "",
                        ]
                          .join(" ")
                          .trim()}
                        style={{
                          padding: "20px 24px",
                          display: "grid",
                          gridTemplateColumns: isProcessing
                            ? "0.6fr 3fr 1fr 1fr"
                            : "0.6fr 2fr 1fr 1.5fr 1fr 1fr",
                          gap: 16,
                          alignItems: isProcessing ? "start" : "center",
                          borderColor: isProcessing
                            ? "rgba(217,119,6,0.30)"
                            : undefined,
                          background: isProcessing
                            ? "rgba(217,119,6,0.03)"
                            : undefined,
                        }}
                      >
                        {/* Icon */}
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: `${p.color}15`,
                            border: `1px solid ${p.color}30`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {p.icon}
                        </div>

                        {/* Event info + progress bar (only when processing) */}
                        <div>
                          <div
                            style={{
                              ...mono(13),
                              color: "#111827",
                              marginBottom: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {p.event}
                            {isNew && !isProcessing && (
                              <span
                                style={{
                                  ...mono(11),
                                  color: "#00D1B2",
                                  background: "rgba(0,209,178,0.1)",
                                  border: "1px solid rgba(0,209,178,0.25)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                }}
                              >
                                New
                              </span>
                            )}
                            {isProcessing && (
                              <span
                                style={{
                                  ...mono(11),
                                  color: "#d97706",
                                  background: "rgba(217,119,6,0.08)",
                                  border: "1px solid rgba(217,119,6,0.25)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                }}
                              >
                                Processing
                              </span>
                            )}
                          </div>
                          <div style={{ ...mono(11), color: "#111827" }}>
                            Auto-triggered
                          </div>

                          {/* Progress bar only during processing */}
                          {isProcessing && p._processingUntil && (
                            <ProcessingBar
                              processingUntil={p._processingUntil}
                              color={p.color}
                            />
                          )}

                          {/* Mobile-only summary */}
                          <div
                            className="payouts-item-mobile-row"
                            style={{
                              display: "none",
                              gap: 8,
                              marginTop: 6,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ ...mono(11), color: "#111827" }}>
                              {p.date} · {p.id}
                            </span>
                            {p.status === "Paid" && (
                              <span className="badge badge-green">Paid</span>
                            )}
                            {p.status === "Pending" && (
                              <span className="badge badge-amber">Pending</span>
                            )}
                            {p.status === "Processing" && (
                              <span className="badge badge-amber">
                                Processing
                              </span>
                            )}
                            {p.status === "Failed" && (
                              <span className="badge badge-red">Failed</span>
                            )}
                            <span
                              style={{
                                ...editorial(16),
                                color: "#111827",
                                marginLeft: "auto",
                              }}
                            >
                              {formatCurrency(p.amount)}
                            </span>
                          </div>
                        </div>

                        {/* ─── Collapsed columns while processing ─── */}
                        {isProcessing ? (
                          <>
                            {/* Severity */}
                            <div>
                              <span
                                style={{
                                  ...mono(11),
                                  color: p.color,
                                  background: `${p.color}15`,
                                  border: `1px solid ${p.color}30`,
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                }}
                              >
                                {p.level}
                              </span>
                            </div>
                            {/* Amount + status stacked */}
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  ...editorial(28),
                                  color: "#d97706",
                                  marginBottom: 6,
                                }}
                              >
                                {formatCurrency(p.amount)}
                              </div>
                              <span
                                style={{
                                  ...mono(11),
                                  color: "#d97706",
                                  background: "rgba(217,119,6,0.08)",
                                  border: "1px solid rgba(217,119,6,0.2)",
                                  padding: "3px 10px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                }}
                              >
                                Processing
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Severity */}
                            <div className="payouts-col-severity">
                              <span
                                style={{
                                  ...mono(11),
                                  color: p.color,
                                  background: `${p.color}15`,
                                  border: `1px solid ${p.color}30`,
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                }}
                              >
                                {p.level}
                              </span>
                            </div>
                            {/* Date & Ref */}
                            <div className="payouts-col-date">
                              <div
                                style={{
                                  ...mono(12),
                                  color: "#111827",
                                  marginBottom: 4,
                                }}
                              >
                                {p.date}
                              </div>
                              <div style={{ ...mono(11), color: "#111827" }}>
                                {p.id}
                              </div>
                            </div>
                            {/* Amount */}
                            <div
                              className="payouts-col-amount"
                              style={{
                                ...editorial(28),
                                color: "#111827",
                                textAlign: "right",
                              }}
                            >
                              {formatCurrency(p.amount)}
                            </div>
                            {/* Status */}
                            <div
                              className="payouts-col-status"
                              style={{ textAlign: "right" }}
                            >
                              {p.status === "Paid" && (
                                <span className="badge badge-green">Paid</span>
                              )}
                              {p.status === "Pending" && (
                                <span className="badge badge-amber">
                                  Pending
                                </span>
                              )}
                              {p.status === "Failed" && (
                                <span className="badge badge-red">Failed</span>
                              )}
                            </div>
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
};

export default PayoutsPage;
