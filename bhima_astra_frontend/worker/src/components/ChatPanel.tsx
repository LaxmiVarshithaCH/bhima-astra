import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorker } from "../context/WorkerContext";

/* ─── Style helpers ────────────────────────────────── */
const inter = (size = 14, weight = 400): React.CSSProperties => ({
  fontFamily: "'Inter', 'Aestera', system-ui, sans-serif",
  fontSize: size,
  fontWeight: weight,
  lineHeight: 1.6,
});

/* ─── Helpers ─────────────────────────────────────── */
function getTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Types ───────────────────────────────────────── */
interface Message {
  id: string;
  text: string;
  sender: "bot" | "user";
  time: string;
}

/* ─── Bot data ────────────────────────────────────── */
const WELCOME_MESSAGE: Message = {
  id: "welcome",
  text: "Hi there! I'm your BHIMA ASTRA support assistant. Ask me anything about your policy, payouts, or plans.",
  sender: "bot",
  time: getTime(),
};

const BOT_REPLIES = [
  "Thanks for reaching out! Let me look into that for you.",
  "Payouts are processed within 4 hours of a trigger event — no paperwork needed.",
  "You can upgrade your plan anytime from the Plans section on your dashboard.",
  "That's a great question. Parametric insurance triggers automatically when thresholds are exceeded.",
  "Our system monitors rainfall, AQI, temperature, and civil disruptions 24/7 across your zone.",
];

/* ─── Personalized FAQ ───────────────────────────── */
interface FaqItem {
  question: string;
  getAnswer: (ctx: FaqContext) => string;
}

interface FaqContext {
  name: string | null;
  plan: string | null;
  city: string | null;
  zone: string | null;
  upi: string | null;
  premium: number | null;
  eventsLeft: number | null;
  eventsUsed: number | null;
  fraudScore: number | null;
  expiryDate: string | null;
  payoutsTotal: number;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What triggers my payout?",
    getAnswer: (ctx) =>
      `${ctx.name ? `Hi ${ctx.name.split(" ")[0]}! ` : ""}Your ${ctx.plan ?? "Standard"} plan auto-triggers when:\n\n` +
      `Rainfall >= 64.5 mm/day (Heavy Rain — Rs.${ctx.plan?.toLowerCase() === "basic" ? "300" : ctx.plan?.toLowerCase() === "premium" ? "600" : "400"})\n` +
      `Heat >= 40 deg C (Heatwave — Rs.300)\n` +
      `AQI >= 300 (Very Poor Air — Rs.300)\n` +
      `Flood / Zone Shutdown — plan payout\n` +
      `Platform Outage / Curfew — plan payout\n\n` +
      `No paperwork needed — payouts are credited to your UPI within 2 hours automatically!`,
  },
  {
    question: "How much will I receive?",
    getAnswer: (ctx) => {
      const plan = ctx.plan?.toLowerCase() ?? "standard";
      const l1 = plan === "basic" ? 300 : plan === "premium" ? 600 : 400;
      const l2 = plan === "basic" ? 300 : plan === "premium" ? 900 : 600;
      const l3 = plan === "basic" ? 600 : plan === "premium" ? 1200 : 800;
      return (
        `${ctx.name ? `${ctx.name.split(" ")[0]}, your ` : "Your "}${ctx.plan ?? "Standard"} plan pays:\n\n` +
        `Rain L1 (>=64.5mm): Rs.${l1}\n` +
        `Rain L2 (>=115.6mm): Rs.${l2}\n` +
        `Rain L3 (>=204.5mm): Rs.${l3}\n` +
        `Heat L1 (>=40 deg C): Rs.300\n` +
        `Heat L2 (>=45 deg C): Rs.${plan === "basic" ? 300 : 600}\n` +
        `AQI L1 (>=300): Rs.300\n` +
        `AQI L2 (>=400): Rs.${plan === "basic" ? 300 : 500}\n\n` +
        `Max 2 events per week. Paid directly to ${ctx.upi ? ctx.upi : "your UPI"}.`
      );
    },
  },
  {
    question: "When does my policy expire?",
    getAnswer: (ctx) =>
      ctx.expiryDate
        ? `${ctx.name ? `${ctx.name.split(" ")[0]}, your ` : "Your "}${ctx.plan ?? "Standard"} policy is active until ${ctx.expiryDate}.\n\nYou have ${ctx.eventsLeft ?? 2} event${ctx.eventsLeft !== 1 ? "s" : ""} remaining this week. Auto-renewal happens every 7 days if your payment method is valid. You will be notified 24 hours before expiry.`
        : `Your policy auto-renews every 7 days. You can check the exact expiry date on your Policy tab or Dashboard. You will receive a notification 24 hours before it expires.`,
  },
  {
    question: "What's my fraud risk score?",
    getAnswer: (ctx) => {
      if (ctx.fraudScore === null) {
        return "Your fraud risk score is calculated by our AI system based on your claim patterns and location signals. A lower score means faster payout processing. Check your Profile tab for your current score.";
      }
      const score = Math.round(ctx.fraudScore * 100);
      const label =
        score < 35 ? "Low Risk" : score < 65 ? "Medium Risk" : "High Risk";
      const msg =
        score < 35
          ? "Your claims will be processed with highest priority — typically within 30 minutes."
          : score < 65
            ? "Most claims clear automatically. Occasionally a quick verification step may be needed."
            : "Some claims may need additional verification. Contact support if you believe this is incorrect.";
      return `${ctx.name ? `${ctx.name.split(" ")[0]}, your ` : "Your "}current fraud risk score is ${score}/100 — ${label}.\n\n${msg}\n\nScores update weekly based on your activity patterns.`;
    },
  },
  {
    question: "How do I upgrade my plan?",
    getAnswer: (ctx) => {
      const current = ctx.plan?.toLowerCase() ?? "standard";
      const next =
        current === "basic"
          ? "Standard (Rs.79/wk)"
          : current === "standard"
            ? "Premium (Rs.119/wk)"
            : null;
      if (!next) {
        return `${ctx.name ? `${ctx.name.split(" ")[0]}, you're ` : "You're "}already on the Premium plan — maximum protection activated!\n\nYou receive up to Rs.1,200 per trigger event with 2 events per week.`;
      }
      return (
        `${ctx.name ? `${ctx.name.split(" ")[0]}, you're ` : "You're "}currently on ${ctx.plan ?? "Standard"}.\n\n` +
        `Upgrade to ${next} for higher payouts per trigger event.\n\n` +
        `Go to Plans tab, select your plan, then click Activate. The new plan takes effect immediately and your UPI ${ctx.upi ? `(${ctx.upi}) ` : ""}will be charged the new weekly amount.`
      );
    },
  },
  {
    question: "Where is my payout sent?",
    getAnswer: (ctx) =>
      ctx.upi
        ? `${ctx.name ? `${ctx.name.split(" ")[0]}, all ` : "All "}your payouts are automatically sent to UPI: ${ctx.upi}\n\nPayments are credited within 2 hours of a verified trigger event. If you need to update your UPI ID, go to Profile and then UPI Accounts.`
        : `All payouts are sent directly to the UPI ID linked to your account. Go to Profile and then UPI Accounts to verify or update your payment details.`,
  },
  {
    question: "What does parametric mean?",
    getAnswer: (ctx) =>
      `Parametric insurance is different from traditional insurance:\n\n` +
      `- No claim forms to fill\n` +
      `- No assessors or investigations\n` +
      `- Payout triggers automatically when a threshold is crossed\n` +
      `- Fixed payout amount — no disputes\n` +
      `- Credited to UPI within 2 hours\n\n` +
      `${ctx.name ? `${ctx.name.split(" ")[0]}, your ` : "Your "}${ctx.plan ?? "Standard"} plan monitors rainfall, heat, AQI, and civil disruptions in ${ctx.zone ? ctx.zone : "your zone"} 24/7. When thresholds are exceeded, we pay — automatically.`,
  },
];

/* ─── Send Icon ───────────────────────────────────── */
const SendIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

/* ─── Shield Icon (bot avatar) ────────────────────── */
const ShieldIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6366F1"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/* ─── Typing Indicator ────────────────────────────── */
const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 4 }}
    transition={{ duration: 0.18 }}
    style={{ display: "flex", alignItems: "flex-start", gap: 8 }}
  >
    {/* Bot avatar dot */}
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        flexShrink: 0,
        background: "#F3F4F6",
        border: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ShieldIcon />
    </div>
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "4px 12px 12px 12px",
        background: "#F3F4F6",
        border: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#9CA3AF",
            flexShrink: 0,
          }}
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            delay: i * 0.15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  </motion.div>
);

/* ─── Chat Bubble ─────────────────────────────────── */
const Bubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isUser = msg.sender === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 4,
      }}
    >
      {/* Avatar row for bot */}
      {!isUser && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              flexShrink: 0,
              background: "#F3F4F6",
              border: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldIcon />
          </div>
          <div
            style={{
              maxWidth: "80%",
              padding: "10px 14px",
              borderRadius: "4px 12px 12px 12px",
              background: "#F3F4F6",
              border: "1px solid #E5E7EB",
              ...inter(14),
              color: "#111827",
              wordBreak: "break-word",
            }}
          >
            {msg.text}
          </div>
        </div>
      )}

      {/* User bubble */}
      {isUser && (
        <div
          style={{
            maxWidth: "80%",
            padding: "10px 14px",
            borderRadius: "12px 4px 12px 12px",
            background: "#4F46E5",
            border: "1px solid #4338CA",
            ...inter(14),
            color: "#FFFFFF",
            wordBreak: "break-word",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Timestamp */}
      <span
        style={{
          ...inter(11, 400),
          color: "#111827",
          ...(isUser ? { marginRight: 2 } : { marginLeft: 36 }),
        }}
      >
        {msg.time}
      </span>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════
   CHAT PANEL COMPONENT
═══════════════════════════════════════════════════ */
export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ open, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null); // null = unknown
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile, policy, payouts } = useWorker();

  // Build FAQ context from real worker data
  const faqCtx: FaqContext = {
    name: profile?.worker_name ?? null,
    plan: policy?.plan_tier
      ? policy.plan_tier.charAt(0).toUpperCase() +
        policy.plan_tier.slice(1).toLowerCase()
      : null,
    city: profile?.city ?? null,
    zone: profile?.geo_zone_id ?? null,
    upi: profile?.upi_id ?? null,
    premium: policy?.weekly_premium ?? null,
    eventsLeft: policy?.events_remaining ?? null,
    eventsUsed: policy?.events_used ?? null,
    fraudScore: profile?.fraud_risk_score ?? null,
    expiryDate: policy?.last_active_date
      ? (() => {
          try {
            return new Date(policy.last_active_date).toLocaleDateString(
              "en-IN",
              {
                day: "2-digit",
                month: "short",
                year: "numeric",
              },
            );
          } catch {
            return policy.last_active_date ?? null;
          }
        })()
      : null,
    payoutsTotal: payouts
      .filter((p) =>
        ["paid", "completed", "approved"].includes(
          (p.payout_status ?? "").toLowerCase(),
        ),
      )
      .reduce((s, p) => s + (p.payout_amount ?? 0), 0),
  };

  // Show FAQ chips whenever the last message is from the bot and the user is not typing
  // This lets the user keep asking questions after each answer
  const lastMessage = messages[messages.length - 1];
  const showFaqChips =
    !typing && lastMessage?.sender === "bot" && !input.trim();

  /* Auto-scroll to latest message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* Focus input when panel opens */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* Reset messages on re-open */
  useEffect(() => {
    if (open) {
      setMessages([{ ...WELCOME_MESSAGE, time: getTime() }]);
      setInput("");
      setTyping(false);
    }
  }, [open]);

  // Handle a FAQ chip click — inject user question + personalized answer
  const handleFaqClick = (faq: FaqItem) => {
    const userMsg: Message = {
      id: `u-faq-${Date.now()}`,
      text: faq.question,
      sender: "user",
      time: getTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    // Short delay to simulate thinking
    setTimeout(() => {
      setTyping(false);
      const botMsg: Message = {
        id: `b-faq-${Date.now()}`,
        text: faq.getAnswer(faqCtx),
        sender: "bot",
        time: getTime(),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 700);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      text,
      sender: "user",
      time: getTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // First: try to match against FAQ for instant personalized answer
    const lowerText = text.toLowerCase();
    const faqMatch = FAQ_ITEMS.find((f) =>
      f.question
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 3)
        .some((w) => lowerText.includes(w)),
    );

    // If API previously failed, use local FAQ/fallback immediately
    if (apiAvailable === false && faqMatch) {
      setTimeout(() => {
        setTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            text: faqMatch.getAnswer(faqCtx),
            sender: "bot",
            time: getTime(),
          },
        ]);
      }, 700);
      return;
    }

    try {
      const BASE_URL =
        (import.meta as unknown as { env: Record<string, string> }).env
          .VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          worker_context: {
            worker_name: profile?.worker_name,
            plan_tier: policy?.plan_tier,
            city: profile?.city,
            geo_zone_id: profile?.geo_zone_id,
            upi_id: profile?.upi_id,
          },
        }),
      });

      if (res.ok) {
        setApiAvailable(true);
        const data = await res.json();
        const replyText =
          data?.response ??
          (faqMatch ? faqMatch.getAnswer(faqCtx) : BOT_REPLIES[0]);
        setTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            text: replyText,
            sender: "bot",
            time: getTime(),
          },
        ]);
      } else {
        throw new Error("non-ok");
      }
    } catch {
      setApiAvailable(false);
      setTyping(false);
      // Use FAQ match if available, otherwise generic fallback
      const reply = faqMatch
        ? faqMatch.getAnswer(faqCtx)
        : BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, text: reply, sender: "bot", time: getTime() },
      ]);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  const canSend = input.trim().length > 0 && !typing;

  return (
    <>
      {/* Scoped styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        @keyframes gs-pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        .gs-chat-scrollarea::-webkit-scrollbar        { width: 4px; }
        .gs-chat-scrollarea::-webkit-scrollbar-track  { background: transparent; }
        .gs-chat-scrollarea::-webkit-scrollbar-thumb  { background: #D1D5DB; border-radius: 9px; }

        .gs-chat-input::placeholder { color: #111827; }
        .gs-chat-input:focus        { outline: none; border-color: #4F46E5 !important; background: #FFFFFF !important; }

        .gs-send-btn:hover:not(:disabled) { background: #4338CA !important; }
        .gs-send-btn:active:not(:disabled){ background: #3730A3 !important; }

        .gs-option-card:hover { background: #F9FAFB !important; border-color: #111827 !important; }
      `}</style>

      <AnimatePresence>
        {open && (
          <>
            {/* ── Backdrop overlay ─────────────────── */}
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={onClose}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 450,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
              }}
            />

            {/* ── Chat panel ───────────────────────── */}
            <motion.div
              key="chat-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                height: "100dvh",
                width: "min(100vw, 380px)",
                zIndex: 500,
                background: "#FFFFFF",
                borderLeft: "1px solid #E5E7EB",
                display: "flex",
                flexDirection: "column",
                boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}
            >
              {/* ── Header ─────────────────────────── */}
              <div
                style={{
                  padding: "18px 20px",
                  borderBottom: "1px solid #E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#F9FAFB",
                  flexShrink: 0,
                }}
              >
                {/* Bot avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldIcon />
                </div>

                {/* Title + status */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      ...inter(15, 600),
                      color: "#111827",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    BHIMA ASTRA
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 3,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#22c55e",
                        animation: "gs-pulse-dot 2.5s infinite",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ ...inter(12), color: "#111827" }}>
                      Online · Avg reply 2 min
                    </span>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  aria-label="Close chat"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    transition: "all 0.15s",
                  }}
                  onMouseOver={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = "#F3F4F6";
                    b.style.color = "#111827";
                    b.style.borderColor = "#D1D5DB";
                  }}
                  onMouseOut={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = "transparent";
                    b.style.color = "#111827";
                    b.style.borderColor = "#E5E7EB";
                  }}
                >
                  ✕
                </button>
              </div>

              {/* ── Date divider ─────────────────── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "16px 20px 4px",
                  flexShrink: 0,
                }}
              >
                <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
                <span
                  style={{
                    ...inter(11),
                    color: "#111827",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date().toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              </div>

              {/* ── Messages area ────────────────── */}
              <div
                className="gs-chat-scrollarea"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {messages.map((msg) => (
                  <Bubble key={msg.id} msg={msg} />
                ))}

                {/* Typing indicator */}
                <AnimatePresence>
                  {typing && <TypingIndicator />}
                </AnimatePresence>

                {/* Auto-scroll anchor */}
                <div ref={bottomRef} />
              </div>

              {/* ── FAQ Suggestion Chips ─────────── */}
              <AnimatePresence>
                {showFaqChips && (
                  <motion.div
                    key="faq-chips"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      padding: "8px 16px 4px",
                      borderTop: "1px solid #F3F4F6",
                      flexShrink: 0,
                      background: "#FAFAFA",
                    }}
                  >
                    <div
                      style={{
                        ...inter(10, 500),
                        color: "#9CA3AF",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Suggested questions
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        paddingBottom: 8,
                      }}
                    >
                      {FAQ_ITEMS.map((faq, i) => (
                        <motion.button
                          key={i}
                          onClick={() => handleFaqClick(faq)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          style={{
                            padding: "6px 12px",
                            background: "#FFFFFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: 20,
                            cursor: "pointer",
                            ...inter(12),
                            color: "#374151",
                            transition:
                              "border-color 0.15s, background 0.15s, color 0.15s",
                            textAlign: "left",
                          }}
                          onMouseOver={(e) => {
                            const b = e.currentTarget as HTMLButtonElement;
                            b.style.borderColor = "#4F46E5";
                            b.style.color = "#4F46E5";
                            b.style.background = "#EEF2FF";
                          }}
                          onMouseOut={(e) => {
                            const b = e.currentTarget as HTMLButtonElement;
                            b.style.borderColor = "#E5E7EB";
                            b.style.color = "#374151";
                            b.style.background = "#FFFFFF";
                          }}
                        >
                          {faq.question}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Input area ───────────────────── */}
              <div
                style={{
                  padding: "14px 16px",
                  borderTop: "1px solid #E5E7EB",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexShrink: 0,
                  background: "#F9FAFB",
                }}
              >
                <input
                  ref={inputRef}
                  className="gs-chat-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message…"
                  autoComplete="off"
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    border: "1px solid #D1D5DB",
                    borderRadius: 10,
                    padding: "10px 14px",
                    ...inter(14),
                    color: "#111827",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                />

                <button
                  className="gs-send-btn"
                  onClick={sendMessage}
                  disabled={!canSend}
                  aria-label="Send message"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: canSend ? "#4F46E5" : "#E5E7EB",
                    border: "none",
                    cursor: canSend ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: canSend ? "#fff" : "#111827",
                    transition: "background 0.18s, color 0.18s",
                  }}
                >
                  <SendIcon />
                </button>
              </div>

              {/* ── Footer branding ──────────────── */}
              <div
                style={{
                  padding: "8px 20px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  flexShrink: 0,
                  background: "#F9FAFB",
                }}
              >
                <span style={{ ...inter(11), color: "#111827" }}>
                  Powered by Bhima Astra AI
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatPanel;
