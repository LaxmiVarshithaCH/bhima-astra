import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { formatINR } from "../../utils/currency";
import { useWorker } from "../../context/WorkerContext";

const mono = { fontFamily: "DM Mono, monospace" } as React.CSSProperties;
const editorial = {
  fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  letterSpacing: "0.02em",
  lineHeight: 1,
} as React.CSSProperties;

// Per-event payout amounts per plan tier — matches PlansTab constants
const PLAN_META: Record<string, { perEventPayout: number; maxWeeklyPayout: number; weeklyPremium: number }> = {
  basic: { perEventPayout: 300, maxWeeklyPayout: 600, weeklyPremium: 49 },
  standard: { perEventPayout: 400, maxWeeklyPayout: 800, weeklyPremium: 79 },
  premium: { perEventPayout: 600, maxWeeklyPayout: 1200, weeklyPremium: 119 },
};


const PolicyStatusCard: React.FC = () => {
  const { policy, loading } = useWorker();
  const [daysLeft, setDaysLeft] = useState(0);
  const [expiryDate, setExpiryDate] = useState<Date>(new Date());

  // Calculate expiry date and days left whenever policy changes
  useEffect(() => {
    let calculatedExpiryDate: Date;

    if (policy?.last_active_date) {
      // last_active_date IS the policy expiry (7-day policy period end date)
      calculatedExpiryDate = new Date(policy.last_active_date);
    } else if (policy?.activation_date) {
      // Fallback: activation + 7 days
      calculatedExpiryDate = new Date(policy.activation_date);
      calculatedExpiryDate.setDate(calculatedExpiryDate.getDate() + 7);
    } else {
      // No policy: 7 days from today
      calculatedExpiryDate = new Date();
      calculatedExpiryDate.setDate(calculatedExpiryDate.getDate() + 7);
    }

    setExpiryDate(calculatedExpiryDate);

    const now = Date.now();
    const calculated = Math.max(
      0,
      Math.ceil((calculatedExpiryDate.getTime() - now) / 86400000),
    );
    setDaysLeft(calculated);
  }, [policy?.last_active_date, policy?.activation_date]);

  const isUrgent = daysLeft <= 14;

  // Resolve plan tier (normalize to lowercase key)
  const tierKey = (policy?.plan_tier ?? "standard").toLowerCase() as keyof typeof PLAN_META;
  const planMeta = PLAN_META[tierKey] ?? PLAN_META.standard;

  // events_remaining is capped at 2 per BHIMA ASTRA spec (max 2 events/week)
  const MAX_EVENTS = 2;
  const eventsRemaining = Math.min(policy?.events_remaining ?? MAX_EVENTS, MAX_EVENTS);
  const eventsUsed = Math.min(policy?.events_used ?? 0, MAX_EVENTS);
  const totalEvents = MAX_EVENTS; // always 2 per plan
  // Prefer ML-locked values stored at activation; fall back to static PLAN_META for no-policy state
  const weeklyPremium = policy?.weekly_premium ?? planMeta.weeklyPremium;
  const perEventPayout = policy?.payout_l1 ?? policy?.per_event_payout ?? planMeta.perEventPayout;
  const maxWeeklyPayout = policy?.max_weekly_payout ?? planMeta.maxWeeklyPayout;
  const monthlyPremium = weeklyPremium * 4;


  const expiryDateString = expiryDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const stats = [
    {
      label: "Events Left",
      value: String(eventsRemaining),
      sub: `of ${totalEvents} this period`,
    },
    {

      label: "Weekly Premium",
      value: formatINR(weeklyPremium),
      sub: `${formatINR(monthlyPremium)}/month billed`,
    },
    {
      label: "Per Event",
      value: formatINR(perEventPayout),
      sub: `max ${formatINR(maxWeeklyPayout)} weekly`,
      color: "#22c55e",
    },
    {
      label: "Expires In",
      value: `${daysLeft}d`,
      sub: expiryDateString,
      urgent: isUrgent,
    },
  ];

  return (

    <motion.div
      style={{
        padding: "26px 28px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 0.3s ease",
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px -30% 0px" }}
      transition={{ duration: 0.65, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#111827",
          }}
        >
          Policy Status
        </span>
        <span
          style={{
            ...mono,
            fontSize: 8,
            padding: "3px 10px",
            borderRadius: 4,
            border: "1px solid #e5e7eb",
            color: "#111827",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {policy?.plan_tier || "Standard"} Plan
        </span>
      </div>

      {/* Active badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div
          className={isUrgent ? "glow-red" : "glow-green"}
          style={{
            width: 8,
            height: 8,
            background: isUrgent ? "#FF5C5C" : "#22c55e",
            borderRadius: "50%",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            ...mono,
            fontSize: 14,
            color: isUrgent ? "#FF5C5C" : "#22c55e",
            letterSpacing: "0.08em",
          }}
        >
          {policy?.policy_status || "ACTIVE"} · KYC VERIFIED
        </span>
      </div>

      {/* Stats 2×2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderTop: "1px solid #f3f4f6",
          flex: 1,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              padding: "16px 4px",
              paddingLeft: i % 2 === 1 ? 16 : 0,
              borderRight: i % 2 === 0 ? "1px solid #f3f4f6" : "none",
              borderBottom: i < 2 ? "1px solid #f3f4f6" : "none",
            }}
          >
            <div
              style={{
                ...mono,
                fontSize: 8,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#111827",
                marginBottom: 5,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                ...editorial,
                fontSize: 26,
                color: s.urgent ? "#FF5C5C" : (s.color ?? "#111827"),
              }}
            >
              {s.value}
            </div>
            <div
              style={{ ...mono, fontSize: 8, color: "#111827", marginTop: 3 }}
            >
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Renew CTA */}
      <motion.button
        whileHover={{
          background: "#22c55e",
          color: "#000",
          borderColor: "#22c55e",
        }}
        transition={{ duration: 0.2 }}
        style={{
          marginTop: 18,
          width: "100%",
          padding: "11px",
          background: "none",
          border: "1px solid rgba(34,197,94,0.35)",
          color: "#22c55e",
          ...mono,
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 8,
          transition: "all 0.2s",
        }}
      >
        Renew Policy →
      </motion.button>
    </motion.div>
  );
};

export default PolicyStatusCard;
