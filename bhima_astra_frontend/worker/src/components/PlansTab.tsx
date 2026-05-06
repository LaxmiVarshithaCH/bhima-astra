import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatINR } from "../utils/currency";
import { useWorker } from "../context/WorkerContext";
import { activatePolicy, comparePlans } from "../services/api";

/* ─────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────── */
/* ── Correct payout data per BHIMA ASTRA spec ──────────────────────
   Source: Trigger Thresholds & Tiered Plan Structure
   All payouts are per-event (parametric — no claims process needed)
─────────────────────────────────────────────────────────────────── */
const plans = [
  {
    key: "basic",
    name: "Basic",
    price: formatINR(49),
    tagline: "Essential parametric cover for part-time & low-income workers.",
    badge: null,
    meta: {
      weeklyPremium: formatINR(49),
      perEventPayout: formatINR(300),
      maxEventsPerWeek: "2 events",
      maxWeeklyPayout: formatINR(600),
      segment: "Part-time / Low income",
    },
    features: [
      // Rainfall triggers (IMD thresholds)
      {
        label: "Rainfall L1 ≥ 64.5 mm/day",
        value: formatINR(300),
        note: "IMD Heavy Rain",
      },
      {
        label: "Rainfall L2 ≥ 115.6 mm/day",
        value: formatINR(300),
        note: "IMD Very Heavy Rain",
      },
      {
        label: "Rainfall L3 ≥ 204.5 mm/day",
        value: formatINR(600),
        note: "IMD Ext. Heavy Rain",
      },
      // Heat triggers
      { label: "Heat L1 ≥ 40 °C", value: formatINR(300), note: "IMD Heatwave" },
      {
        label: "Heat L2 ≥ 45 °C",
        value: formatINR(300),
        note: "IMD Severe Heatwave",
      },
      // Air quality triggers (CPCB thresholds)
      { label: "AQI L1 ≥ 300", value: formatINR(300), note: "CPCB Very Poor" },
      { label: "AQI L2 ≥ 400", value: formatINR(300), note: "CPCB Severe" },
      // Event-based triggers
      {
        label: "Flood / Zone Shutdown",
        value: "Plan payout",
        note: "State / IMD alert",
      },
      {
        label: "Platform Outage / Curfew",
        value: "Plan payout",
        note: "System / Manager verified",
      },
    ],
  },
  {
    key: "standard",
    name: "Standard",
    price: formatINR(79),
    tagline:
      "Balanced parametric cover — our most popular plan for regular workers.",
    badge: "MOST POPULAR",
    meta: {
      weeklyPremium: formatINR(79),
      perEventPayout: formatINR(400),
      maxEventsPerWeek: "2 events",
      maxWeeklyPayout: formatINR(800),
      segment: "Regular full-time workers",
    },
    features: [
      {
        label: "Rainfall L1 ≥ 64.5 mm/day",
        value: formatINR(400),
        note: "IMD Heavy Rain",
      },
      {
        label: "Rainfall L2 ≥ 115.6 mm/day",
        value: formatINR(600),
        note: "IMD Very Heavy Rain",
      },
      {
        label: "Rainfall L3 ≥ 204.5 mm/day",
        value: formatINR(800),
        note: "IMD Ext. Heavy Rain",
      },
      { label: "Heat L1 ≥ 40 °C", value: formatINR(300), note: "IMD Heatwave" },
      {
        label: "Heat L2 ≥ 45 °C",
        value: formatINR(600),
        note: "IMD Severe Heatwave",
      },
      { label: "AQI L1 ≥ 300", value: formatINR(300), note: "CPCB Very Poor" },
      { label: "AQI L2 ≥ 400", value: formatINR(500), note: "CPCB Severe" },
      {
        label: "Flood / Zone Shutdown",
        value: "Plan payout",
        note: "State / IMD alert",
      },
      {
        label: "Platform Outage / Curfew",
        value: "Plan payout",
        note: "System / Manager verified",
      },
    ],
  },
  {
    key: "premium",
    name: "Premium",
    price: formatINR(119),
    tagline:
      "Maximum parametric protection for high-income & full-time gig workers.",
    badge: "BEST VALUE",
    meta: {
      weeklyPremium: formatINR(119),
      perEventPayout: formatINR(600),
      maxEventsPerWeek: "2 events",
      maxWeeklyPayout: formatINR(1200),
      segment: "High-income / Full-time",
    },
    features: [
      {
        label: "Rainfall L1 ≥ 64.5 mm/day",
        value: formatINR(600),
        note: "IMD Heavy Rain",
      },
      {
        label: "Rainfall L2 ≥ 115.6 mm/day",
        value: formatINR(900),
        note: "IMD Very Heavy Rain",
      },
      {
        label: "Rainfall L3 ≥ 204.5 mm/day",
        value: formatINR(1200),
        note: "IMD Ext. Heavy Rain",
      },
      { label: "Heat L1 ≥ 40 °C", value: formatINR(300), note: "IMD Heatwave" },
      {
        label: "Heat L2 ≥ 45 °C",
        value: formatINR(600),
        note: "IMD Severe Heatwave",
      },
      { label: "AQI L1 ≥ 300", value: formatINR(300), note: "CPCB Very Poor" },
      { label: "AQI L2 ≥ 400", value: formatINR(500), note: "CPCB Severe" },
      {
        label: "Flood / Zone Shutdown",
        value: "Plan payout",
        note: "State / IMD alert",
      },
      {
        label: "Platform Outage / Curfew",
        value: "Plan payout",
        note: "System / Manager verified",
      },
    ],
  },
];

/* ─────────────────────────────────────────────────
   SPARKLE (Twinkling)
───────────────────────────────────────────────── */
const Sparkles: React.FC<{ intensity: "none" | "medium" | "heavy" }> = ({
  intensity,
}) => {
  if (intensity === "none") return null;

  const positions =
    intensity === "heavy"
      ? [
          { top: "12%", left: "8%", delay: "0s", size: 6 },
          { top: "20%", right: "12%", delay: "0.4s", size: 4 },
          { top: "60%", left: "5%", delay: "0.8s", size: 5 },
          { top: "75%", right: "8%", delay: "0.2s", size: 7 },
          { top: "45%", right: "4%", delay: "1.1s", size: 4 },
          { top: "88%", left: "15%", delay: "0.6s", size: 5 },
          { top: "35%", left: "85%", delay: "0.5s", size: 6 },
          { top: "15%", left: "50%", delay: "0.9s", size: 4 },
          { top: "82%", right: "25%", delay: "0.3s", size: 5 },
        ]
      : [
          { top: "18%", left: "15%", delay: "0s", size: 5 },
          { top: "40%", right: "10%", delay: "0.6s", size: 4 },
          { top: "78%", left: "20%", delay: "0.3s", size: 5 },
          { top: "65%", right: "15%", delay: "1s", size: 6 },
        ];

  return (
    <>
      {positions.map((p, i) => (
        <div
          key={i}
          className="sparkle"
          style={{
            ...p,
            width: p.size,
            height: p.size,
            background: "rgba(0,0,0,0.15)",
            animationDelay: p.delay,
            animationDuration: `${1.6 + i * 0.3}s`,
            position: "absolute",
          }}
        />
      ))}
    </>
  );
};

/* ─────────────────────────────────────────────────
   ACTIVATE BUTTON with rotating lines
───────────────────────────────────────────────── */
const RotatingBorderButton: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="activate-btn"
      style={{
        width: "100%",
        padding: "16px 36px",
        color: "#fff",
        fontFamily: "DM Mono, monospace",
        fontSize: 12,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        cursor: "pointer",
        marginTop: 24,
      }}
    >
      <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
    </button>
  );
};

/* ─────────────────────────────────────────────────
   ACTIVATION MODAL
───────────────────────────────────────────────── */
const ActivationModal: React.FC<{
  plan: (typeof plans)[0];
  onClose: () => void;
}> = ({ plan, onClose }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useWorker();

  // Auto-close 1.8s after success so dashboard updates are visible
  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(() => onClose(), 1800);
    return () => clearTimeout(t);
  }, [confirmed, onClose]);

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      const tier = plan.key.charAt(0).toUpperCase() + plan.key.slice(1); // e.g. "Basic"
      await activatePolicy(tier);
      // Await refresh so PolicyStatusCard re-renders with new plan immediately
      await refresh();
      setConfirmed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Activation failed";
      setError(msg);
      console.error("[PlansTab] Plan activation failed:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(12px)",
      }}
    >
      <motion.div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          width: "100%",
          maxWidth: 400,
          margin: "0 16px",
          position: "relative",
          overflow: "hidden",
        }}
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 24, stiffness: 300 }}
      >
        <div style={{ height: 2, background: "#e5e7eb" }} />

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            border: "1px solid #e5e7eb",
            background: "none",
            cursor: "pointer",
            color: "#111827",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s, border-color 0.2s",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
            (e.currentTarget as HTMLButtonElement).style.color = "#111827";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "none";
            (e.currentTarget as HTMLButtonElement).style.color = "#111827";
          }}
        >
          ✕
        </button>

        <div style={{ padding: "32px 36px" }}>
          {!confirmed ? (
            <>
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontsize: 11,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Plan Activation
              </div>
              <div
                style={{
                  fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
                  fontSize: 32,
                  letterSpacing: "0.04em",
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Confirm {plan.name}
              </div>
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontsize: 13,
                  color: "#111827",
                  marginBottom: 28,
                  lineHeight: 1.6,
                }}
              >
                Activate{" "}
                <strong style={{ color: "#111827" }}>{plan.name} Plan</strong>{" "}
                at{" "}
                <strong style={{ color: "#111827" }}>{plan.price}/month</strong>
                ? First payment deducted immediately.
              </div>

                {error && (
                  <div style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    color: "#dc2626",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    padding: "10px 14px",
                    marginBottom: 16,
                    lineHeight: 1.5,
                  }}>
                    ⚠ {error}
                  </div>
                )}

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  onClick={handleConfirm}
                  disabled={processing}
                  style={{
                    flex: 1,
                    padding: "13px",
                    background: "#00D1B2",
                    color: "#ffffff",
                    border: "none",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    cursor: processing ? "not-allowed" : "pointer",
                    opacity: processing ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "opacity 0.2s",
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  {processing ? (
                    <>
                      <motion.span
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid #ffffff",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          display: "inline-block",
                        }}
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 0.7,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                      Processing...
                    </>
                  ) : (
                    "Confirm & Pay"
                  )}
                </motion.button>

                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: "13px",
                    border: "1px solid #e5e7eb",
                    background: "none",
                    color: "#111827",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.borderColor = "#d1d5db")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.borderColor = "#e5e7eb")
                  }
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <motion.div
              style={{ textAlign: "center" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.div
                style={{
                  width: 64,
                  height: 64,
                  border: "2px solid #00D1B2",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  background: "#ffffff",
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00D1B2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>
              <div
                style={{
                  fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
                  fontSize: 30,
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                {plan.name} Activated
              </div>
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 8,
                  lineHeight: 1.7,
                }}
              >
                <div>Weekly: <strong style={{ color: "#111827" }}>{plan.meta.weeklyPremium}</strong></div>
                <div>Coverage: <strong style={{ color: "#22c55e" }}>{plan.meta.maxWeeklyPayout}</strong> / week</div>
                <div>Events: <strong style={{ color: "#111827" }}>{plan.meta.maxEventsPerWeek}</strong></div>
              </div>
              <div style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                color: "#9ca3af",
                marginTop: 16,
                letterSpacing: "0.1em",
              }}>
                Closing automatically…
              </div>
            </motion.div>
          )}

        </div>
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────────
   FAQ SECTION
───────────────────────────────────────────────── */
const faqs = [
  {
    question: "When is a payout triggered?",
    answer:
      "Payouts are automatically triggered when our independent weather or event data sources confirm a qualifying hazard in your active zone. No manual claim is required.",
  },
  {
    question: "How fast do I receive payout?",
    answer:
      "Once a trigger is confirmed, payouts are processed instantly and usually reflect in your linked bank account or UPI within 2-4 hours.",
  },
  {
    question: "Can I change plan mid-week?",
    answer:
      "Yes, you can upgrade your plan at any time. The new coverage limits will take effect immediately upon successful payment of the prorated difference.",
  },
  {
    question: "What if I miss trigger notification?",
    answer:
      "Even if you miss the notification, your payout is secured. The system auto-deposits funds based on data, not on your acknowledgment.",
  },
  {
    question: "Is there a waiting period?",
    answer:
      "Coverage becomes active 24 hours after your initial plan purchase. Renewals do not have a waiting period.",
  },
];

const FAQItem: React.FC<{
  item: { question: string; answer: string };
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}> = ({ item, isExpanded, onExpand, onCollapse }) => {
  return (
    <motion.div
      onMouseEnter={onExpand}
      onMouseLeave={onCollapse}
      onClick={() => (isExpanded ? onCollapse() : onExpand())}
      style={{
        background: isExpanded ? "#ffffff" : "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 16,
        cursor: "pointer",
        boxShadow: isExpanded
          ? "0 8px 24px rgba(0,0,0,0.08)"
          : "0 2px 8px rgba(0,0,0,0.02)",
        transform: isExpanded ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 14,
            color: isExpanded ? "#111827" : "#111827",
            fontWeight: 500,
            transition: "color 0.3s",
          }}
        >
          {item.question}
        </div>
        <div
          style={{
            color: isExpanded ? "#00D1B2" : "#111827",
            fontSize: 18,
            transition: "color 0.3s, transform 0.3s",
          }}
        >
          {isExpanded ? "−" : "+"}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 8 }} // Exit smoothly
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                paddingTop: 16,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#111827",
                lineHeight: 1.6,
              }}
            >
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FAQSection = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div
      style={{
        marginTop: 80,
        paddingBottom: 60,
        maxWidth: 800,
        margin: "80px auto 0",
      }}
    >
      <div
        style={{
          fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
          fontSize: 36,
          letterSpacing: "0.04em",
          color: "#111827",
          lineHeight: 1,
          marginBottom: 32,
          textAlign: "center",
        }}
      >
        Frequently Asked Questions
      </div>
      <div>
        {faqs.map((faq, index) => (
          <FAQItem
            key={index}
            item={faq}
            isExpanded={expandedIndex === index}
            onExpand={() => setExpandedIndex(index)}
            onCollapse={() => {
              if (expandedIndex === index) setExpandedIndex(null);
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────
   SPARKLE PARTICLES (pre-computed to avoid Math.random in render)
───────────────────────────────────────────────── */
const SparkleParticles: React.FC<{ isPremium: boolean }> = ({ isPremium }) => {
  const count = isPremium ? 12 : 6;
  const color = isPremium ? "#d97706" : "#2563eb";

  // Compute random values once per mount (not on every render)
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        top: `${(i * 137.5) % 100}%`, // golden-angle distribution
        left: `${(i * 97.3 + 11) % 100}%`,
        size: 2 + (i % 3) * 1.5,
        duration: `${1.5 + (i % 4) * 0.4}s`,
        delay: `${(i * 0.27) % 2}s`,
      })),
    [count],
  );

  return (
    <div style={{ position: "absolute", inset: -25, pointerEvents: "none" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            borderRadius: "50%",
            boxShadow: `0 0 5px ${color}`,
            animation: `bannerSparkleBlip ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────
   PLAN BANNER
───────────────────────────────────────────────── */
const PlanBanner: React.FC<{ type: "standard" | "premium" }> = ({ type }) => {
  const isPremium = type === "premium";
  const bgGradient = isPremium
    ? "linear-gradient(135deg, #fffbeb, #fef3c7, #fffbeb)"
    : "linear-gradient(135deg, #eff6ff, #dbeafe, #eff6ff)";
  const glow = isPremium
    ? "0 6px 20px rgba(245, 158, 11, 0.3), 0 0 10px rgba(245, 158, 11, 0.18)"
    : "0 6px 20px rgba(59, 130, 246, 0.25), 0 0 10px rgba(59, 130, 246, 0.15)";

  return (
    <div
      style={{
        marginBottom: 20,
        position: "relative",
        zIndex: 2,
        display: "inline-block",
      }}
    >
      <style>{`
        @keyframes bannerShine {
          0% { left: -100%; opacity: 0; }
          10% { opacity: 1; }
          50% { left: 200%; opacity: 1; }
          100% { left: 200%; opacity: 0; }
        }
        @keyframes bannerFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes bannerSparkleBlip {
          0%, 100% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      {/* Sparkles positioned around the banner — positions pre-computed to avoid Math.random in render */}
      <SparkleParticles isPremium={isPremium} />

      <div
        style={{
          animation: "bannerFloat 3.5s ease-in-out infinite",
          background: bgGradient,
          borderRadius: 6,
          padding: "6px 20px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: glow,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "40px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            transform: "skewX(-25deg)",
            animation: "bannerShine 3s infinite ease-out",
          }}
        />
        <span
          style={{
            fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
            fontSize: 22,
            letterSpacing: "0.12em",
            color: isPremium ? "#d97706" : "#2563eb",
            position: "relative",
            fontWeight: 700,
          }}
        >
          {type.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────
   BASIC TIER BADGE
───────────────────────────────────────────────── */
const BasicTierBadge: React.FC = () => {
  return (
    <div
      style={{
        marginBottom: 20,
        position: "relative",
        zIndex: 2,
        display: "inline-block",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #b45309, #f59e0b)",
          borderRadius: 999,
          padding: "6px 18px",
          boxShadow:
            "0 6px 20px rgba(180, 83, 9, 0.15), 0 0 12px rgba(180, 83, 9, 0.12)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontFamily: "DM Mono, monospace",
          fontsize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        BASIC
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────
   PLAN SELECTOR CARD (3D TILT)
───────────────────────────────────────────────── */
const PlanSelectorCard: React.FC<{
  plan: (typeof plans)[0];
  active: boolean;
  onClick: () => void;
}> = ({ plan, active, onClick }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 768px)").matches);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Limits: rotateX: ~2deg, rotateY: ~3deg
    const rotateY = ((x - centerX) / centerX) * 3;
    const rotateX = -((y - centerY) / centerY) * 2;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      animate={{
        x: active ? 0 : 4,
        rotateX: isHovered && !isMobile ? tilt.x : 0,
        rotateY: isHovered && !isMobile ? tilt.y : 0,
        z: isHovered && !isMobile ? 6 : 0,
        y: isHovered && isMobile ? -2 : 0, // Mobile lift only
        boxShadow: isHovered
          ? active
            ? "0 12px 24px rgba(0,209,178,0.2)"
            : "0 12px 24px rgba(0,0,0,0.1)"
          : active
            ? "0 4px 12px rgba(0,209,178,0.1)"
            : "0 2px 8px rgba(0,0,0,0.05)",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{
        border: `1px solid ${active ? (plan.key === "basic" ? "#fcd34d" : plan.key === "standard" ? "rgba(59, 130, 246, 0.4)" : "rgba(245, 158, 11, 0.4)") : "#e5e7eb"}`,
        background: active
          ? plan.key === "basic"
            ? "#fff7ed"
            : plan.key === "standard"
              ? "#eff6ff"
              : "#fffbeb"
          : "transparent",
        padding: "24px 28px",
        cursor: "pointer",
        position: "relative",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {plan.key === "standard" && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            border: "1px solid rgba(59, 130, 246, 0.4)",
            background: "#eff6ff",
            color: "#2563eb",
            fontFamily: "DM Mono, monospace",
            fontSize: 8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: "12px",
            boxShadow: "0 0 8px rgba(59, 130, 246, 0.25)",
            transform: "translateZ(10px)", // pop out slightly in 3D space
          }}
        >
          Recommended
        </div>
      )}
      <div
        style={{
          fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
          fontSize: 32,
          letterSpacing: "0.04em",
          color: active
            ? plan.key === "basic"
              ? "#b45309"
              : plan.key === "standard"
                ? "#2563eb"
                : "#d97706"
            : "#111827",
          lineHeight: 1,
          marginBottom: 4,
          transition: "color 0.3s",
          transform: "translateZ(15px)", // pop out
        }}
      >
        {plan.name}
      </div>
      <div
        style={{
          fontFamily: "DM Mono, monospace",
          fontSize: 12,
          color: active
            ? plan.key === "basic"
              ? "#b45309"
              : plan.key === "standard"
                ? "#2563eb"
                : "#d97706"
            : "#111827",
          transition: "color 0.3s",
          transform: "translateZ(10px)",
        }}
      >
        {plan.price} / wk
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────
   PLANS TAB — MAIN EXPORT
───────────────────────────────────────────────── */
const PlansTab: React.FC = () => {
  const { policy } = useWorker();
  const [activatingPlan, setActivatingPlan] = useState<
    (typeof plans)[0] | null
  >(null);
  const activeTier = policy?.plan_tier?.toLowerCase() ?? "standard";
  const [currentPlanCode, setCurrentPlanCode] = useState(activeTier);

  // ML-personalised plan data from /plans/compare
  const [apiPlansMap, setApiPlansMap] = useState<Record<string, any>>({});
  useEffect(() => {
    comparePlans().then((res) => {
      const map: Record<string, any> = {};
      for (const p of res.plans ?? []) map[p.tier] = p;
      setApiPlansMap(map);
    }).catch(() => {}); // silently fall back to static data
  }, []);

  useEffect(() => {
    if (policy?.plan_tier) {
      setCurrentPlanCode(policy.plan_tier.toLowerCase());
    }
  }, [policy?.plan_tier]);

  const selectedPlan = plans.find((p) => p.key === currentPlanCode) || plans[1];

  // Merge ML payout values into the selected plan for display
  const effectiveSelectedPlan = useMemo(() => {
    const api = apiPlansMap[selectedPlan.key];
    if (!api) return selectedPlan;
    return {
      ...selectedPlan,
      price: formatINR(api.weekly_premium),
      meta: {
        ...selectedPlan.meta,
        weeklyPremium: formatINR(api.weekly_premium),
        perEventPayout: formatINR(api.payout_l1),
        maxWeeklyPayout: formatINR(api.payout_l3 * 2),
      },
      features: selectedPlan.features.map((f) => {
        if (f.value === "Plan payout") return f; // event-based stays as-is
        // Map trigger label to L1/L2/L3 payout
        let payout: number;
        if (f.label.includes("L3")) payout = api.payout_l3;
        else if (f.label.includes("L2")) payout = api.payout_l2;
        else payout = api.payout_l1;
        return { ...f, value: formatINR(payout) };
      }),
    };
  }, [selectedPlan, apiPlansMap]);

  const isBasic = effectiveSelectedPlan.key === "basic";
  const isStandard = effectiveSelectedPlan.key === "standard";

  const intensityMap: Record<string, "none" | "medium" | "heavy"> = {
    basic: "none",
    standard: "medium",
    premium: "heavy",
  };

  return (
    <div
      className="plans-tab-wrap"
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: "0 32px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .plan-card {
          border: 1px solid #1F2430;
          box-shadow: 0 12px 30px rgba(0,0,0,0.3);
          transition: all 0.3s ease !important;
        }
        .glow-basic {
          border: 1px solid #fcd34d !important;
          box-shadow: 0 0 50px rgba(180, 83, 9, 0.12) !important;
        }
        .glow-basic:hover {
          box-shadow: 0 12px 32px rgba(180, 83, 9, 0.14) !important, 0 0 70px rgba(180, 83, 9, 0.18) !important;
        }
        .glow-standard {
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
          box-shadow: 0 0 50px rgba(59, 130, 246, 0.25) !important;
        }
        .glow-standard:hover {
          box-shadow: 0 12px 32px rgba(59, 130, 246, 0.18) !important, 0 0 70px rgba(59, 130, 246, 0.22) !important;
        }
        .glow-premium {
          border: 1px solid rgba(245, 158, 11, 0.4) !important;
          box-shadow: 0 0 50px rgba(245, 158, 11, 0.3) !important;
        }
        .glow-premium:hover {
          box-shadow: 0 12px 32px rgba(245, 158, 11, 0.2) !important, 0 0 70px rgba(245, 158, 11, 0.22) !important;
        }
        @media (max-width: 1200px) {
          .plans-tab-wrap { padding: 0 24px !important; }
        }
        @media (max-width: 768px) {
          .plans-tab-wrap { padding: 0 16px !important; }
          .plans-detail-card { padding: 24px 20px !important; }
          .plans-header-title { font-size: clamp(32px, 7vw, 52px) !important; }
          .plans-activate-btn { max-width: 100% !important; }
        }
      `}</style>
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontFamily: "DM Mono, monospace",
            fontsize: 11,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#111827",
            marginBottom: 10,
          }}
        >
          Protection Plans
        </div>
        <div
          className="plans-header-title"
          style={{
            fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
            fontSize: 52,
            letterSpacing: "0.04em",
            color: "#111827",
            lineHeight: 1,
          }}
        >
          Choose Your Shield
        </div>
        <div
          style={{
            fontFamily: "DM Mono, monospace",
            fontsize: 13,
            color: "#111827",
            marginTop: 8,
            maxWidth: 480,
            lineHeight: 1.6,
          }}
        >
          All plans include automatic claim triggers based on real-time weather
          and event data in your zone.
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full items-stretch">
        {/* Left Side Selector */}
        <div
          className="w-full lg:w-[320px] flex flex-col gap-4 flex-shrink-0"
          style={{ perspective: "900px" }}
        >
          {plans.map((plan) => {
            const api = apiPlansMap[plan.key];
            const effectivePlan = api
              ? { ...plan, price: formatINR(api.weekly_premium) }
              : plan;
            return (
              <PlanSelectorCard
                key={plan.key}
                plan={effectivePlan}
                active={plan.key === currentPlanCode}
                onClick={() => setCurrentPlanCode(plan.key)}
              />
            );
          })}
        </div>

        {/* Right Side Details */}
        <div
          className="w-full lg:flex-1 relative plans-detail-wrapper"
          style={{ perspective: "1000px" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={effectiveSelectedPlan.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{
                background: isBasic
                  ? "#fff7ed"
                  : isStandard
                    ? "#eff6ff"
                    : "#fffbeb",
                padding: "40px",
                position: "relative",
                overflow: "hidden",
                minHeight: "100%",
                display: "flex",
                flexDirection: "column",
                transformStyle: "preserve-3d",
                transform: "translateZ(8px)",
                willChange: "transform",
                color: "#111827",
              }}
              whileHover={{
                y: -2,
                translateZ: 12,
              }}
              className={`
                plan-card
                ${effectiveSelectedPlan.key === "basic" ? "glow-basic" : ""}
                ${effectiveSelectedPlan.key === "standard" ? "glow-standard" : ""}
                ${effectiveSelectedPlan.key === "premium" ? "glow-premium" : ""}
                ${effectiveSelectedPlan.key === "standard" || effectiveSelectedPlan.key === "premium" ? "float-anim" : ""}
              `}
            >
              <Sparkles intensity={intensityMap[selectedPlan.key]} />

              {isBasic ? (
                <BasicTierBadge />
              ) : (
                selectedPlan.key !== "basic" && (
                  <PlanBanner
                    type={selectedPlan.key as "standard" | "premium"}
                  />
                )
              )}

              <div
                style={{
                  fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
                  fontSize: 52,
                  letterSpacing: "0.04em",
                  color: isBasic
                    ? "#b45309"
                    : isStandard
                      ? "#2563eb"
                      : "#d97706",
                  lineHeight: 1,
                  marginBottom: 8,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {effectiveSelectedPlan.name}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginBottom: 16,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 36,
                    fontWeight: 700,
                    color: isBasic
                      ? "#b45309"
                      : isStandard
                        ? "#2563eb"
                        : "#d97706",
                  }}
                >
                  {effectiveSelectedPlan.price}
                </span>
                <span
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 12,
                    color: "#111827",
                    letterSpacing: "0.08em",
                  }}
                >
                  /week
                </span>
              </div>

              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  color: "#111827",
                  letterSpacing: "0.04em",
                  marginBottom: 32,
                  lineHeight: 1.6,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {effectiveSelectedPlan.tagline}
              </div>

              {/* ── Meta stats strip ─────────────────────────────── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 0,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 28,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {[
                  {
                    label: "Weekly Premium",
                    value: effectiveSelectedPlan.meta.weeklyPremium,
                    base: selectedPlan.meta.weeklyPremium,
                  },
                  {
                    label: "Per Event Payout",
                    value: effectiveSelectedPlan.meta.perEventPayout,
                    base: selectedPlan.meta.perEventPayout,
                  },
                  {
                    label: "Max Events / Week",
                    value: effectiveSelectedPlan.meta.maxEventsPerWeek,
                    base: null,
                  },
                  {
                    label: "Max Weekly Payout",
                    value: effectiveSelectedPlan.meta.maxWeeklyPayout,
                    base: selectedPlan.meta.maxWeeklyPayout,
                  },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "14px 18px",
                      background: "rgba(255,255,255,0.6)",
                      borderRight: i % 2 === 0 ? "1px solid #e5e7eb" : "none",
                      borderBottom: i < 2 ? "1px solid #e5e7eb" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "Bebas Neue, Barlow Condensed, sans-serif",
                        fontSize: 22,
                        color: isBasic
                          ? "#b45309"
                          : isStandard
                            ? "#2563eb"
                            : "#d97706",
                        letterSpacing: "0.03em",
                        lineHeight: 1,
                      }}
                    >
                      {s.value}
                    </div>
                    {/* Gray base plan rate for transparency — only when ML differs */}
                    {s.base && s.base !== s.value && (
                      <div
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 8,
                          color: "#9ca3af",
                          marginTop: 3,
                          letterSpacing: "0.04em",
                        }}
                      >
                        Standard: {s.base}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Trigger payout table ─────────────────────────── */}
              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  marginBottom: 24,
                  position: "relative",
                  zIndex: 1,
                  paddingTop: 20,
                }}
              >
                <div
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#6b7280",
                    marginBottom: 12,
                  }}
                >
                  Parametric Trigger Payouts — Auto-credited, no claims needed.
                  Your personalised rates shown · <span style={{ color: "#9ca3af" }}>grey = standard base rate</span>
                </div>

                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: "8px 16px",
                    padding: "6px 10px",
                    background: "rgba(0,0,0,0.04)",
                    borderRadius: "6px 6px 0 0",
                    borderBottom: "1px solid #e5e7eb",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#6b7280",
                    }}
                  >
                    Trigger
                  </span>
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                    Standard
                  </span>
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#6b7280",
                      textAlign: "right",
                    }}
                  >
                    Your Rate
                  </span>
                </div>

                {/* Table rows */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    flex: 1,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {effectiveSelectedPlan.features.map((f, i) => {
                    const isEventBased = f.value === "Plan payout";
                    const accentColor = isBasic
                      ? "#b45309"
                      : isStandard
                        ? "#2563eb"
                        : "#d97706";
                    return (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: "6px 16px",
                          padding: "8px 10px",
                          borderRadius: 6,
                          background:
                            i % 2 === 0
                              ? "rgba(255,255,255,0.5)"
                              : "transparent",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 10,
                              color: "#111827",
                              letterSpacing: "0.04em",
                              lineHeight: 1.3,
                            }}
                          >
                            {f.label}
                          </div>
                        </div>
                        <div
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 9,
                            color: "#6b7280",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {f.note}
                        </div>
                        <div
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: isEventBased ? 9 : 12,
                            fontWeight: 700,
                            color: isEventBased ? accentColor : "#111827",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {f.value}
                          {/* Base plan rate in gray — only shown when ML differs */}
                          {!isEventBased &&
                            selectedPlan.features[i]?.value !== f.value && (
                              <div
                                style={{
                                  fontFamily: "DM Mono, monospace",
                                  fontSize: 8,
                                  color: "#9ca3af",
                                  fontWeight: 400,
                                  marginTop: 2,
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Base: {selectedPlan.features[i]?.value}
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Exclusions note */}
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 10px",
                    background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.15)",
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#ef4444",
                      marginBottom: 3,
                    }}
                  >
                    Not Covered
                  </div>
                  <div
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      color: "#6b7280",
                      lineHeight: 1.6,
                    }}
                  >
                    Health · Life · Accidents · Vehicle damage · Pandemic / War
                    disruptions
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 40,
                  width: "100%",
                  maxWidth: 300,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <RotatingBorderButton
                  label={`Activate ${effectiveSelectedPlan.name} →`}
                  onClick={() => setActivatingPlan(selectedPlan)}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Render FAQ Section at the bottom */}
      <FAQSection />

      <AnimatePresence>
        {activatingPlan && (
          <ActivationModal
            plan={activatingPlan}
            onClose={() => setActivatingPlan(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlansTab;
