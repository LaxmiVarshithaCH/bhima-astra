import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatINR } from "../utils/currency";
import { useLocation, useNavigate } from "react-router-dom";
import PlansTab from "./PlansTab";
import ForecastPage from "./ForecastPage";
import PolicyPage from "./PolicyPage";
import PayoutsPage from "./PayoutsPage";
import ProfilePageFull from "./ProfilePage";
import FloatingChatbot from "./FloatingChatbot";
import NotificationsPanel from "./NotificationsPanel";

// ── Widget imports ───────────────────────────────────────────────────────
import LiveWeatherWidget from "./dashboard/LiveWeatherWidget";
import CompositeScoreGauge from "./dashboard/CompositeScoreGauge";
import TodayEarningsEstimate from "./dashboard/TodayEarningsEstimate";
import ActiveTriggerAlert from "./dashboard/ActiveTriggerAlert";
import WeeklyForecastTeaser from "./dashboard/WeeklyForecastTeaser";
import RecentPayoutsTimeline from "./dashboard/RecentPayoutsTimeline";
import LiveZoneMap from "./dashboard/LiveZoneMap";
import { useWorker } from "../context/WorkerContext";
import { useLanguage } from "../context/LanguageContext";

interface DashboardProps {
  onLogout: () => void;
}

type Tab =
  | "Dashboard"
  | "Policy"
  | "Forecasts"
  | "Payouts"
  | "Plans"
  | "Profile";
const NAV_TABS: Tab[] = [
  "Dashboard",
  "Policy",
  "Forecasts",
  "Payouts",
  "Plans",
];

/* ─── Style utilities ────────────────────────────── */
const mono = (size = 9): React.CSSProperties => ({
  fontFamily: "DM Mono, monospace",
  fontSize: size < 11 ? (size <= 8 ? 17 : 17.5) : size + 4,
  fontWeight: size < 11 ? 500 : undefined,
  letterSpacing: "0.12em",
});
const editorial = (size = 36): React.CSSProperties => ({
  fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  fontSize: size + 4,
  letterSpacing: "0.03em",
  lineHeight: 1,
});

/* ─── Scroll Reveal Hook ─────────────────────────── */
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

/* ─── Section wrapper with blur-reveal ──────────────── */
const Section: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  id?: string;
}> = ({ children, delay = 0, style, id }) => {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      id={id}
      className="section-reveal"
      style={{
        transitionDelay: `${delay}s`,
        marginBottom: 70,
        minHeight: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ─── Section Label ──────────────────────────────── */
const SectionLabel: React.FC<{
  text: string;
  accent?: string;
  premium?: boolean;
}> = ({ text, accent = "rgba(255,255,255,0.1)", premium }) => (
  <div
    className="section-label"
    style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}
  >
    <div
      style={{
        width: premium ? 4 : 3,
        height: 16,
        background: premium
          ? `linear-gradient(to bottom, #22c55e, transparent)`
          : accent,
        borderRadius: 2,
        flexShrink: 0,
      }}
    />
    <span
      className="section-label-text"
      style={{
        letterSpacing: premium ? "1.5px" : "normal",
        textTransform: premium ? "uppercase" : "none",
        color: "#111827",
        textShadow: "none",
      }}
    >
      {text}
    </span>
    <div className="section-label-line" />
  </div>
);

/* ─── TAB ICONS ──────────────────────────────────── */
const TabIcon: React.FC<{ tab: Tab; size?: number }> = ({ tab, size = 18 }) => {
  const s: React.CSSProperties = { width: size, height: size, flexShrink: 0 };
  switch (tab) {
    case "Dashboard":
      return (
        <svg
          style={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "Policy":
      return (
        <svg
          style={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "Forecasts":
      return (
        <svg
          style={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 12h18M3 6h18M3 18h18" strokeDasharray="2 2" />
          <circle cx="12" cy="12" r="3" fill="none" />
        </svg>
      );
    case "Payouts":
      return (
        <svg
          style={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3h12" />
          <path d="M6 8h12" />
          <path d="m6 13 8.5 8" />
          <path d="M6 13h3" />
          <path d="M9 13c6.667 0 6.667-10 0-10" />
        </svg>
      );
    case "Plans":
      return (
        <svg
          style={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
        </svg>
      );
  }
};

/* ─── PROFILE SIDE-PANEL ─────────────────────────── */
const getRiskLabel = (score: number): { label: string; color: string } => {
  if (score < 30) return { label: "Low Risk", color: "#22c55e" };
  if (score < 70) return { label: "Moderate Risk", color: "#FBBF24" };
  return { label: "High Risk", color: "#FF5C5C" };
};

const ProfilePage: React.FC<{ onClose: () => void; onLogout: () => void }> = ({
  onClose,
  onLogout,
}) => {
  const { profile, policy } = useWorker();
  const { t } = useLanguage();

  // fraud_risk_score from backend is 0–1; convert to 0–100 for display
  const rawScore = profile?.fraud_risk_score ?? null;
  const fraudScore = rawScore !== null ? Math.round(rawScore * 100) : null;
  const risk = fraudScore !== null ? getRiskLabel(fraudScore) : null;
  const PLAN_META = {
    basic: { coverage: 300, weeklyPremium: 49 },
    standard: { coverage: 400, weeklyPremium: 79 },
    premium: { coverage: 600, weeklyPremium: 119 },
  };

  const tierKey = (policy?.plan_tier ?? "standard").toLowerCase();
  const planMeta = PLAN_META[tierKey];
  const displayName = profile?.worker_name ?? "Worker";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const zoneDisplay = profile?.geo_zone_id ?? "Zone —";
  const policyLabel = policy?.plan_tier
    ? policy.plan_tier.charAt(0).toUpperCase() +
    policy.plan_tier.slice(1).toLowerCase() +
    ` — ${formatINR(policy.weekly_premium ?? 79)}/wk`
    : "No active plan";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.4, ease: [0.77, 0, 0.175, 1] }}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        maxWidth: 380,
        background: "#ffffff",
        borderLeft: "1px solid #e5e7eb",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
      }}
    >
      {/* Top accent */}
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, #60A5FA, #00D1B2)",
        }}
      />

      <div
        style={{
          padding: "26px 30px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{ ...mono(8), textTransform: "uppercase", color: "#111827" }}
        >
          {t('profile')}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            color: "#111827",
            width: 28,
            height: 28,
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            borderRadius: 6,
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#111827";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6";
            (e.currentTarget as HTMLButtonElement).style.color = "#111827";
          }}
        >
          ✕
        </button>
      </div>

      {/* Avatar */}
      <div
        style={{
          padding: "36px 30px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(0,209,178,0.15))",
            border: "1px solid rgba(96,165,250,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...editorial(20),
            color: "#60A5FA",
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ ...editorial(24), color: "#111827" }}>
            {displayName}
          </div>
          <div
            style={{
              ...mono(8),
              color: "#111827",
              marginTop: 3,
              textTransform: "uppercase",
            }}
          >
            Gig Worker · {zoneDisplay}
          </div>
          <div
            className={`badge ${profile?.kyc_verified ? "badge-green" : "badge-amber"}`}
            style={{ marginTop: 6 }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "currentColor",
              }}
            />
            {profile?.kyc_verified ? "KYC Verified" : "KYC Pending"}
          </div>

          {/* ── Fraud Risk Score ─────────────────────── */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                ...mono(8),
                color: "#111827",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              Fraud Risk
            </span>
            {risk ? (
              <>
                <span
                  style={{ ...mono(10), color: "#111827", fontWeight: 500 }}
                >
                  {fraudScore} / 100
                </span>
                <span
                  style={{
                    ...mono(7),
                    color: risk.color,
                    border: `1px solid ${risk.color}40`,
                    background: `${risk.color}12`,
                    borderRadius: 4,
                    padding: "1px 6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {risk.label}
                </span>
              </>
            ) : (
              <span style={{ ...mono(8), color: "#111827" }}>—</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {[
          {
            label: "Worker ID",
            value: profile ? `WRK-${profile.worker_id}` : "—",
          },
          {
            label: "Phone",
            value: profile?.phone_number ? `+91 ${profile.phone_number}` : "—",
          },
          { label: "Zone", value: zoneDisplay },
          {
            label: "Platform",
            value: profile?.platform ?? "—",
          },
          {
            label: "Vehicle",
            value: profile?.vehicle_type ?? "—",
          },
          { label: "Active Plan", value: policyLabel },
          {
            label: "KYC Status",
            value: profile?.kyc_verified ? "● Verified" : "● Pending",
          },
          {
            label: "UPI ID",
            value: profile?.upi_id ?? "—",
          },
        ].map(({ label, value }) => (
          <div key={label} className="data-row">
            <span
              style={{
                ...mono(8),
                textTransform: "uppercase",
                color: "#111827",
              }}
            >
              {label}
            </span>
            <span style={{ ...mono(10), color: "#111827" }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "22px 30px", borderTop: "1px solid #e5e7eb" }}>
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            padding: "12px",
            background: "none",
            border: "1px solid rgba(255,92,92,0.35)",
            color: "#FF5C5C",
            ...mono(9),
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "all 0.25s",
            borderRadius: 8,
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#FF5C5C";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "none";
            (e.currentTarget as HTMLButtonElement).style.color = "#FF5C5C";
          }}
        >
          Sign Out
        </button>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════
   DASHBOARD OVERVIEW — 10 SECTIONS
═══════════════════════════════════════════════════ */
const DashboardOverview: React.FC = () => {
  const navigate = useNavigate();
  const [showDocsModal, setShowDocsModal] = useState(false);
  const { profile, policy, payouts, zoneLive } = useWorker();

  // ── Derived stats from real data ─────────────────────────────────────
  const riskIndex = zoneLive
    ? Math.round(zoneLive.zone_risk_score * 100)
    : null;

  const thisMonthTotal = payouts
    .filter((p) => {
      if (!p.claim_timestamp) return false;
      const d = new Date(p.claim_timestamp);
      const now = new Date();
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear() &&
        ["paid", "completed", "approved"].includes(
          (p.payout_status ?? "").toLowerCase(),
        )
      );
    })
    .reduce((sum, p) => sum + (p.payout_amount ?? 0), 0);

  const totalClaims = payouts.filter((p) =>
    ["paid", "completed", "approved"].includes(
      (p.payout_status ?? "").toLowerCase(),
    ),
  ).length;

  const activePlanTier = policy?.plan_tier
    ? policy.plan_tier.charAt(0).toUpperCase() +
    policy.plan_tier.slice(1).toLowerCase() +
    " Plan"
    : "Standard Plan";

  const MAX_EVENTS = 2;
  const eventsLeft = Math.min(policy?.events_remaining ?? MAX_EVENTS, MAX_EVENTS);
  const weeklyPremium = policy?.weekly_premium ?? 79;
  const PLAN_META = {
    basic: { coverage: 300, weeklyPremium: 49 },
    standard: { coverage: 400, weeklyPremium: 79 },
    premium: { coverage: 600, weeklyPremium: 119 },
  };

  const tierKey = (policy?.plan_tier ?? "standard").toLowerCase();
  const planMeta = PLAN_META[tierKey];
  const policyNo = profile
    ? `WRK-${profile.worker_id}-${(profile.worker_name ?? "XX").slice(0, 2).toUpperCase()}`
    : "WRK-2401-XZ";

  const zoneDisplay = profile?.geo_zone_id ?? "Zone A-7";

  // Expiry display from last_active_date
  const expiryDisplay = (() => {
    if (!policy?.last_active_date) return "—";
    try {
      return new Date(policy.last_active_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return policy.last_active_date;
    }
  })();

  const daysUntilExpiry = useMemo(() => {
    if (!policy?.last_active_date) return null;
    try {
      const now = new Date();
      const diff = new Date(policy.last_active_date).getTime() - now.getTime();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return null;
    }
  }, [policy]);

  const navigateAction = (route: string, scrollSelector?: string) => {
    navigate(route);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (scrollSelector) {
        setTimeout(() => {
          const el = document.querySelector(scrollSelector) as HTMLElement;
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            const originalBoxShadow = el.style.boxShadow;
            el.style.boxShadow = "0 0 0 4px rgba(0,209,178,0.5)";
            el.style.transition = "box-shadow 0.3s ease";
            setTimeout(() => {
              el.style.boxShadow = originalBoxShadow;
            }, 2000);
          }
        }, 100);
      }
    }, 500);
  };

  return (
    <div>
      {/* ════════════════════════════════════════════
          § 1 · POLICY STATUS HERO CARD
      ════════════════════════════════════════════ */}

      <Section id="policy-hero" style={{ marginBottom: 0 }}>
        {/* Hero heading */}
        <div
          style={{
            paddingBottom: 48,
            marginBottom: 48,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  className="pulse-dot"
                  style={{
                    width: 7,
                    height: 7,
                    background: "#22c55e",
                    borderRadius: "50%",
                    color: "#22c55e",
                  }}
                />
                <span
                  style={{
                    ...mono(9),
                    textTransform: "uppercase",
                    color: "#111827",
                    letterSpacing: "0.2em",
                  }}
                >
                  Live Coverage Active · {zoneDisplay}
                </span>
              </div>
              <h1
                className="dash-hero-heading"
                style={{ ...editorial(64), color: "#111827", lineHeight: 0.88 }}
              >
                <span style={{ fontSize: 72 }}>Worker</span>
                <br />
                <span style={{ color: "#111827" }}>Shield</span>&nbsp;
              </h1>
            </div>
            <div
              className="dash-stats-row"
              style={{
                display: "flex",
                gap: 32,
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              {[
                {
                  label: "Risk Index",
                  value: riskIndex !== null ? String(riskIndex) : "—",
                  color: "#FBBF24",
                },
                {
                  label: "This Month",
                  value: formatINR(thisMonthTotal),
                  color: "#111827",
                },
                {
                  label: "Claims",
                  value: String(totalClaims),
                  color: "#22c55e",
                },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "right" }}>
                  <div
                    style={{
                      ...mono(13),
                      textTransform: "uppercase",
                      color: "#111827",
                      marginBottom: 4,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ ...editorial(32), color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Policy Hero Card */}
        <div className="pcard pcard-green" style={{ padding: "44px 36px" }}>
          {/* Background glow */}
          <div
            className="hero-glow"
            style={{
              width: 300,
              height: 300,
              background: "#22c55e",
              top: -80,
              right: -60,
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 40,
              alignItems: "flex-start",
              position: "relative",
            }}
          >
            {/* Left: active status */}
            <div
              className="dash-policy-card-inner"
              style={{ flex: "1", minWidth: 240 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  className="glow-green"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#22c55e",
                  }}
                />
                <span
                  style={{
                    ...mono(10),
                    color: "#22c55e",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  Policy Active ·{" "}
                  {profile?.kyc_verified ? "KYC Verified" : "KYC Pending"}
                </span>
              </div>

              <div
                style={{ ...editorial(48), color: "#111827", marginBottom: 6 }}
              >
                {activePlanTier}
              </div>
              <div
                style={{
                  ...mono(10),
                  color: "#111827",
                  letterSpacing: "0.08em",
                }}
              >
                Policy No. {policyNo} · {zoneDisplay}
              </div>

              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span className="badge badge-green">✓ Active</span>
                <span className="badge badge-blue">KYC Verified</span>
                {daysUntilExpiry !== null && (
                  <span className="badge badge-amber">
                    Renewal in {daysUntilExpiry}d
                  </span>
                )}
              </div>
            </div>

            {/* Right: stats 2×2 */}
            <div
              className="dash-stats-2x2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 0,
                flex: "1",
                minWidth: 260,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {[
                {
                  label: "Events Left",
                  value: String(eventsLeft),
                  sub: `of ${eventsLeft + (policy?.events_used ?? 0)} this period`,
                  color: "#111827",
                },
                {
                  label: "Weekly Premium",
                  value: formatINR(weeklyPremium),
                  sub: `${formatINR(weeklyPremium * 4)}/month billed`,
                  color: "#111827",
                },
                {
                  label: "Coverage",
                  value: formatINR(planMeta.coverage),
                  sub: "per trigger event",
                  color: "#16a34a",
                },
                {
                  label: "Expires In",
                  value: daysUntilExpiry !== null ? `${daysUntilExpiry}d` : "—",
                  sub: expiryDisplay,
                  color: "#d97706",
                },
              ].map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    padding: "28px 22px",
                    background: "#f9fafb",
                    borderRight: i % 2 === 0 ? "1px solid #e5e7eb" : "none",
                    borderBottom: i < 2 ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  <div
                    style={{
                      ...mono(13),
                      textTransform: "uppercase",
                      color: "#111827",
                      marginBottom: 6,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ ...editorial(30), color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ ...mono(12), color: "#111827", marginTop: 3 }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Renew CTA */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <motion.button
              className="btn-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() =>
                navigateAction("/policy", ".policy-renewal-section")
              } /* mock selector mapping */
              style={{ fontSize: 14, fontWeight: 500, color: "#ffffff" }}
            >
              Renew Policy →
            </motion.button>
            <motion.button
              className="btn-outline"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowDocsModal(true)}
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              View Documents
            </motion.button>
          </div>
        </div>
      </Section>

      {/* Live Zone Map moved here */}
      <div style={{ marginTop: 40, marginBottom: 64 }}>
        <LiveZoneMap />
      </div>

      {/* ════════════════════════════════════════════
          § 2 · LIVE WEATHER + RISK SCORE
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="Live Weather + Risk Score" accent="#22c55e" />

        <div style={{ position: "relative" }}>
          {/* Cards Grid */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {/* Weather Card Wrapper */}
            <motion.div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                overflow: "visible",
              }}
              whileHover={{ y: -3, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <LiveWeatherWidget />
            </motion.div>

            {/* Risk Card Wrapper */}
            <motion.div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                overflow: "visible",
              }}
              whileHover={{ y: -3, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <CompositeScoreGauge
                score={zoneLive ? zoneLive.zone_risk_score : 0.72}
              />
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          § 3 · TODAY'S EARNINGS
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="Today's Earnings" accent="#00D1B2" />
        <TodayEarningsEstimate />
      </Section>

      {/* ════════════════════════════════════════════
          § 4 · FORECAST TEASER
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="7-Day Forecast" accent="#FBBF24" />
        <WeeklyForecastTeaser />
      </Section>

      {/* ════════════════════════════════════════════
          § 5 · ACTIVE EVENTS
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="Active Events" accent="#FF5C5C" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ActiveTriggerAlert isActive={true} />

          {/* Event history cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {[
              {
                type: "RAINFALL",
                location: "Vijayawada City",
                severity: "HIGH",
                time: "3h ago",
                status: "Claim Filed",
                color: "#ff0202ff",
              },
              {
                type: "HEAT WAVE",
                location: "Yanamalakuduru",
                severity: "MODERATE",
                time: "1d ago",
                status: "Monitoring",
                color: "#d96c06ff",
              },
              {
                type: "AQI SPIKE",
                location: "Zone A-7",
                severity: "MODERATE",
                time: "2d ago",
                status: "Resolved",
                color: "#d96c06ec",
              },
            ].map((ev) => (
              <div
                key={ev.type}
                className="pcard"
                style={{ padding: "24px 20px" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      ...mono(9),
                      color: ev.color,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {ev.type}
                  </span>
                  <span
                    style={{
                      ...mono(7),
                      color: ev.status === "Resolved" ? "#16a34a" : "#111827",
                    }}
                  >
                    {ev.status}
                  </span>
                </div>
                <div
                  style={{
                    ...editorial(18),
                    color: "#111827",
                    marginBottom: 6,
                  }}
                >
                  {ev.location}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    className={`badge ${ev.severity === "HIGH" ? "badge-red" : "badge-amber"}`}
                  >
                    {ev.severity}
                  </span>
                  <span style={{ ...mono(8), color: "#111827" }}>
                    {ev.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
      {/* ════════════════════════════════════════════
          § 10 · ACTIVE POLICY DETAILS
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="Active Policy Details" accent="#22c55e" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {/* Policy info card */}
          <div className="pcard" style={{ padding: "36px 30px" }}>
            <div
              style={{
                ...mono(9),
                color: "#111827",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                marginBottom: 18,
              }}
            >
              Policy Information
            </div>
            {[
              { label: "Policy Number", value: policyNo },
              {
                label: "Plan Type",
                value: policy?.plan_tier
                  ? policy.plan_tier.charAt(0).toUpperCase() +
                  policy.plan_tier.slice(1).toLowerCase()
                  : "Standard",
              },
              {
                label: "Issue Date",
                value: policy?.activation_date
                  ? new Date(policy.activation_date).toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    },
                  )
                  : "—",
              },
              { label: "Expiry Date", value: expiryDisplay },
              {
                label: "Premium",
                value: `${formatINR(weeklyPremium)} / week`,
              },
              {
                label: "Coverage Amount",
                value: `${formatINR(50000)} / event`,
              },
              { label: "Max Events / Wk", value: "2 triggers" },
              {
                label: "Payment Method",
                value: profile?.upi_id ? `UPI · ${profile.upi_id}` : "UPI · —",
              },
            ].map((r) => (
              <div key={r.label} className="data-row">
                <span
                  style={{
                    ...mono(13),
                    color: "#111827",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{ ...mono(16), fontWeight: 500, color: "#111827" }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          {/* Coverage breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Coverage triggers */}
            <div className="pcard" style={{ padding: "36px 30px" }}>
              <div
                style={{
                  ...mono(9),
                  color: "#111827",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  marginBottom: 16,
                }}
              >
                Covered Triggers
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {[
                  {
                    trigger: "Heavy Rainfall",
                    threshold: "> 25 mm / hr",
                    payout: formatINR(2000),
                    color: "#60A5FA",
                  },
                  {
                    trigger: "Extreme Heat",
                    threshold: "> 43°C sustained",
                    payout: formatINR(1500),
                    color: "#FF5C5C",
                  },
                  {
                    trigger: "AQI Hazard",
                    threshold: "AQI > 300",
                    payout: formatINR(1000),
                    color: "#FBBF24",
                  },
                  {
                    trigger: "Flood Alert",
                    threshold: "Govt. Level 2+",
                    payout: formatINR(3000),
                    color: "#00D1B2",
                  },
                  {
                    trigger: "Civil Disruption",
                    threshold: "Curfew / Strike",
                    payout: formatINR(2500),
                    color: "#A78BFA",
                  },
                ].map((t) => (
                  <div
                    key={t.trigger}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: `${t.color}06`,
                      border: `1px solid ${t.color}18`,
                      borderRadius: 8,
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          ...mono(9),
                          color: t.color,
                          letterSpacing: "0.08em",
                          marginBottom: 2,
                        }}
                      >
                        {t.trigger}
                      </div>
                      <div style={{ ...mono(7), color: "#111827" }}>
                        {t.threshold}
                      </div>
                    </div>
                    <div
                      style={{
                        ...editorial(18),
                        color: "#111827",
                        flexShrink: 0,
                      }}
                    >
                      {t.payout}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          § 6 · RECENT PAYOUTS
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="Recent Payouts" accent="#22c55e" />
        <RecentPayoutsTimeline />
      </Section>

      {/* ════════════════════════════════════════════
          § 7 · HOW IT WORKS
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="How It Works" accent="#6b7280" />
        <div className="pcard pcard-white" style={{ padding: "48px 40px" }}>
          <div
            className="dash-hw-steps"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: 0,
              position: "relative",
            }}
          >
            {[
              {
                step: "01",
                icon: (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                title: "Activate Policy",
                desc: "Choose a plan and activate parametric coverage for your gig zone in under 2 minutes.",
                color: "#60A5FA",
              },
              {
                step: "02",
                icon: (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M12 2A10 10 0 0 0 2 12c0 4 2 7.4 5 9.3M12 2a10 10 0 0 1 10 10c0 4-2 7.4-5 9.3" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ),
                title: "We Monitor Events",
                desc: "AI monitors rainfall, AQI, temperature, and wind 24/7 across your active coverage zone.",
                color: "#FBBF24",
              },
              {
                step: "03",
                icon: (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 3h12" />
                    <path d="M6 8h12" />
                    <path d="m6 13 8.5 8" />
                    <path d="M6 13h3" />
                    <path d="M9 13c6.667 0 6.667-10 0-10" />
                  </svg>
                ),
                title: "Auto Payout",
                desc: `When thresholds are exceeded, ${formatINR(2000)}–${formatINR(5000)} is instantly transferred to your UPI — no paperwork.`,
                color: "#22c55e",
              },
            ].map((step, i, arr) => (
              <React.Fragment key={step.step}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 200,
                    padding: "0 32px",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  {/* Step icon */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: `${step.color}12`,
                      border: `1px solid ${step.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    {step.icon}
                  </div>
                  <div
                    style={{
                      ...mono(8),
                      color: step.color,
                      letterSpacing: "0.2em",
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    Step {step.step}
                  </div>
                  <div
                    style={{
                      ...editorial(22),
                      color: "#111827",
                      marginBottom: 10,
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      ...mono(9),
                      color: "#111827",
                      lineHeight: 1.7,
                      maxWidth: 220,
                      margin: "0 auto",
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div
                    style={{
                      alignSelf: "center",
                      flexShrink: 0,
                      color: "#111827",
                      fontSize: 24,
                      padding: "0 4px",
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                    }}
                  >
                    <div className="step-connector" style={{ width: 40 }} />
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="#d1d5db"
                      stroke="none"
                    >
                      <polygon points="5,12 1,7 1,17" />
                      <polygon points="13,12 9,7 9,17" />
                      <polygon points="21,12 17,7 17,17" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          § 8 · PLANS PREVIEW
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <SectionLabel text="Plans Preview" accent="#FBBF24" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              name: "Basic",
              price: formatINR(49),
              period: "/month",
              coverage: formatINR(25000),
              events: "3 events",
              color: "#111827",
              features: ["Rainfall", "Heat Wave", "Basic Support"],
              current: false,
            },
            {
              name: "Standard",
              price: formatINR(79),
              period: "/month",
              coverage: formatINR(50000),
              events: "5 events",
              color: "#60A5FA",
              features: [
                "All Basic",
                "AQI Events",
                "Flood Alert",
                "Priority Support",
              ],
              current: true,
            },
            {
              name: "Premium",
              price: formatINR(119),
              period: "/month",
              coverage: formatINR(100000),
              events: "Unlimited",
              color: "#FBBF24",
              features: [
                "All Standard",
                "Cyclone Cover",
                "SMS Alerts",
                "30-Day Forecast",
                "Dedicated Agent",
              ],
              current: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className="pcard"
              style={{
                padding: "36px 24px",
                borderColor: plan.current ? `${plan.color}40` : undefined,
                background: plan.current ? `rgba(96,165,250,0.04)` : undefined,
                position: "relative",
              }}
            >
              {plan.current && (
                <div
                  style={{
                    position: "absolute",
                    top: -1,
                    left: "50%",
                    transform: "translateX(-50%)",
                    ...mono(7),
                    color: "#60A5FA",
                    background: "#f5f7fb",
                    border: "1px solid rgba(96,165,250,0.4)",
                    padding: "2px 14px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  Current Plan
                </div>
              )}

              <div
                style={{ marginBottom: 16, marginTop: plan.current ? 12 : 0 }}
              >
                <div
                  style={{
                    ...mono(9),
                    color: plan.color,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {plan.name}
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 2 }}
                >
                  <span style={{ ...editorial(36), color: "#111827" }}>
                    {plan.price}
                  </span>
                  <span style={{ ...mono(9), color: "#111827" }}>
                    {plan.period}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <div>
                  <div
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      marginBottom: 3,
                    }}
                  >
                    Coverage
                  </div>
                  <div style={{ ...editorial(18), color: plan.color }}>
                    {plan.coverage}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      marginBottom: 3,
                    }}
                  >
                    Events
                  </div>
                  <div style={{ ...editorial(18), color: "#111827" }}>
                    {plan.events}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  marginBottom: 20,
                }}
              >
                {plan.features.map((f) => (
                  <div
                    key={f}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={plan.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ ...mono(8), color: "#111827" }}>{f}</span>
                  </div>
                ))}
              </div>

              <motion.button
                whileHover={plan.current ? {} : { scale: 1.02 }}
                whileTap={plan.current ? {} : { scale: 0.97 }}
                onClick={() => {
                  if (!plan.current) {
                    navigateAction(
                      `/plans?select=${plan.name.toLowerCase()}`,
                      `.plan-card-${plan.name.toLowerCase()}`,
                    );
                  }
                }}
                className={plan.current ? "btn-outline" : "btn-primary"}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  fontSize: 10,
                  opacity: plan.current ? 0.5 : 1,
                  cursor: plan.current ? "not-allowed" : "pointer",
                }}
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : `Upgrade to ${plan.name}`}
              </motion.button>
            </div>
          ))}
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          § 9 · ACTIVATE PROTECTION
      ════════════════════════════════════════════ */}
      <Section delay={0.05}>
        <div
          className="pcard dash-cta-card"
          style={{
            padding: "64px 44px",
            background: "#f0f7ff",
            borderColor: "#bfdbfe",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                ...mono(10),
                color: "#2563eb",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              🛡 Activate Protection
            </div>
            <div
              style={{
                ...editorial(48),
                color: "#111827",
                marginBottom: 14,
                lineHeight: 0.95,
              }}
            >
              Don't Let Weather
              <br />
              Stop Your Income
            </div>
            <div
              style={{
                ...mono(10),
                color: "#111827",
                lineHeight: 1.8,
                maxWidth: 480,
                margin: "0 auto 28px",
              }}
            >
              Parametric insurance pays out automatically when conditions are
              bad. No claims process. No paperwork. Money in your account within
              hours.
            </div>

            <div
              className="dash-activate-stats"
              style={{
                display: "flex",
                gap: 36,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 28,
              }}
            >
              {[
                { value: `${formatINR(2000)}+`, label: "Avg Payout" },
                { value: "< 4 hrs", label: "Settlement Time" },
                { value: "12,000+", label: "Workers Protected" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ ...editorial(30), color: "#2563eb" }}>
                    {s.value}
                  </div>
                  <div
                    style={{
                      ...mono(8),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      marginTop: 4,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <motion.button
                className="btn-primary"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{ fontSize: 12, padding: "14px 36px" }}
                onClick={() => navigateAction("/plans")}
              >
                Activate Full Coverage →
              </motion.button>
              <motion.button
                className="btn-outline"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigateAction("/plans")}
              >
                Compare Plans
              </motion.button>
            </div>
          </div>
        </div>
      </Section>

      {/* MODAL: View Documents */}
      <AnimatePresence>
        {showDocsModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "none",
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                padding: "32px",
                borderRadius: 16,
                width: 400,
                maxWidth: "90%",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
              }}
            >
              <h3
                style={{ ...editorial(28), color: "#111827", marginBottom: 12 }}
              >
                Policy Documents
              </h3>
              <p style={{ ...mono(9), color: "#111827", marginBottom: 24 }}>
                Download your active coverage policy terms and schedules.
              </p>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ ...mono(10), color: "#111827" }}>
                    Schedule_APR2026.pdf
                  </span>
                  <span
                    style={{ color: "#2563eb", cursor: "pointer", ...mono(9) }}
                  >
                    ↓ DL
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ ...mono(10), color: "#111827" }}>
                    Terms_Conditions.pdf
                  </span>
                  <span
                    style={{ color: "#2563eb", cursor: "pointer", ...mono(9) }}
                  >
                    ↓ DL
                  </span>
                </div>
              </div>

              <motion.button
                className="btn-outline"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDocsModal(false)}
                style={{
                  marginTop: 24,
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                Close
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── PLACEHOLDER TABS ───────────────────────────── */
const TabPlaceholder: React.FC<{ tab: Tab }> = ({ tab }) => (
  <div style={{ paddingTop: 80, textAlign: "center" }}>
    <div
      style={{
        ...mono(8),
        textTransform: "uppercase",
        color: "#111827",
        marginBottom: 14,
        letterSpacing: "0.24em",
      }}
    >
      Section
    </div>
    <div
      style={{
        ...editorial(72),
        color: "rgba(255,255,255,0.04)",
        marginBottom: 12,
      }}
    >
      {tab}
    </div>
    <div style={{ ...mono(9), color: "#111827" }}>
      This section is being built — check back soon.
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════
   MAIN DASHBOARD SHELL
═══════════════════════════════════════════════════ */
const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [, setHeaderBlur] = useState(false);
  const { profile } = useWorker();
  const { t } = useLanguage();

  // Map tab key -> translation key
  const tabLabel = (tab: Tab): string => {
    const map: Record<Tab, string> = {
      Dashboard: 'dashboard', Policy: 'policy', Forecasts: 'forecasts',
      Payouts: 'payouts', Plans: 'plans', Profile: 'profile',
    };
    return t(map[tab]);
  };

  // Derive tab from pathname
  const getTabFromPath = (): Tab => {
    const p = location.pathname.toLowerCase();
    if (p.includes("/profile")) return "Profile";
    if (p.includes("/policy")) return "Policy";
    if (p.includes("/forecast")) return "Forecasts";
    if (p.includes("/payout")) return "Payouts";
    if (p.includes("/plan")) return "Plans";
    return "Dashboard";
  };
  const tab = getTabFromPath();
  const isProfile = tab === "Profile";

  useEffect(() => {
    const onScroll = () => setHeaderBlur(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Reset scroll on tab change */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const setTab = (t: Tab) => {
    let p = "/dashboard";
    if (t === "Policy") p = "/policy";
    if (t === "Forecasts") p = "/forecasts";
    if (t === "Payouts") p = "/payouts";
    if (t === "Plans") p = "/plans";
    if (t === "Profile") p = "/profile";
    navigate(p);
  };

  const renderContent = () => {
    switch (tab) {
      case "Dashboard":
        return <DashboardOverview />;
      case "Forecasts":
        return <ForecastPage />;
      case "Plans":
        return (
          <div style={{ paddingTop: 40 }}>
            <PlansTab />
          </div>
        );
      case "Policy":
        return <PolicyPage />;
      case "Payouts":
        return <PayoutsPage />;
      case "Profile":
        return (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
            <ProfilePageFull
              onLogout={() => {
                onLogout();
              }}
            />
          </div>
        );
      default:
        return <TabPlaceholder tab={tab} />;
    }
  };

  return (
    <div
      className="admin-shell"
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#111827",
        position: "relative",
      }}
    >
      {/* ── FLOATING HEADER ─────────────────────────── */}
      <header
        className="app-header"
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          boxShadow: "none",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span
            style={{
              ...mono(9),
              textTransform: "uppercase",
              color: "#111827",
              letterSpacing: "0.18em",
              fontWeight: 600,
            }}
          >
            BHIMA ASTRA
          </span>
        </div>

        {/* Centre nav — hidden on mobile */}
        <nav
          className="desktop-nav-tabs"
          style={{ display: "flex", alignItems: "center", gap: 0 }}
        >
          {NAV_TABS.map((navTab) => (
            <button
              key={navTab}
              onClick={() => setTab(navTab)}
              style={{
                padding: "0 16px",
                height: 58,
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === navTab ? "#111827" : "transparent"}`,
                color: tab === navTab ? "#111827" : "#111827",
                textTransform: "uppercase",
                fontSize: 15,
                fontWeight: tab === navTab ? 600 : 400,
                letterSpacing: "0.4px",
                cursor: "pointer",
                transition: "color 0.2s, border-color 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => {
                if (tab !== navTab)
                  (e.currentTarget as HTMLButtonElement).style.color = "#111827";
              }}
              onMouseOut={(e) => {
                if (tab !== navTab)
                  (e.currentTarget as HTMLButtonElement).style.color = "#111827";
              }}
            >
              {tabLabel(navTab)}
            </button>
          ))}
        </nav>

        {/* Right controls: notifications + profile avatar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <NotificationsPanel />
          <div style={{ width: 1, height: 18, background: "#e5e7eb" }} />
          <span
            style={{
              ...mono(8),
              color: "#111827",
              letterSpacing: "0.06em",
              fontWeight: 500,
            }}
          >
            {profile?.worker_name ?? "Worker"}
          </span>
          <button
            onClick={() => setTab("Profile")}
            aria-label="Go to profile"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: isProfile ? "#111827" : "#f3f4f6",
              border: isProfile ? "1px solid #111827" : "1px solid #d1d5db",
              boxShadow: "none",
              color: isProfile ? "#ffffff" : "#111827",
              ...mono(9),
              letterSpacing: "0.04em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              if (!isProfile)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#e5e7eb";
            }}
            onMouseOut={(e) => {
              if (!isProfile)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#f3f4f6";
            }}
          >
            {profile?.worker_name
              ? profile.worker_name
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
              : "W"}
          </button>
        </div>
      </header>

      {/* ── MAIN BODY ─────────────────────────────── */}
      <main
        className="dashboard-body"
        style={{
          maxWidth: "none",
          minHeight: "100vh",
          margin: "0 auto",
        }}
      >
        <style>{`
          .dashboard-body {
            padding: ${tab === "Forecasts" || tab === "Policy" || tab === "Payouts" || tab === "Plans" ? "32px 0 80px" : "32px 32px 80px"};
          }
          @media (min-width: 1024px) {
            .dashboard-body {
              padding: ${tab === "Forecasts" || tab === "Policy" || tab === "Payouts" || tab === "Plans" || tab === "Profile" ? "90px 0 80px" : "90px 32px 80px"};
            }
          }
          @media (max-width: 768px) {
            .dash-hero-heading { font-size: clamp(36px, 8vw, 64px) !important; line-height: 0.9 !important; }
            .dash-stats-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
            .dash-policy-card-inner { flex-direction: column !important; }
            .dash-stats-2x2 { grid-template-columns: 1fr 1fr !important; }
            .dash-hw-steps { flex-direction: column !important; align-items: center !important; }
            .dash-cta-card { padding: 40px 20px !important; }
            .dash-main-header { padding: 0 16px !important; }
            .dash-activate-stats { gap: 16px !important; }
          }
          @media (max-width: 1200px) {
            .dash-hero-heading { font-size: clamp(42px, 6vw, 64px) !important; }
          }
        `}</style>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── MOBILE BOTTOM NAV (all 5 tabs) ───────────── */}
      <nav className="bottom-nav admin-bottom-nav">
        {NAV_TABS.map((navTab) => {
          const isActive = tab === navTab;
          return (
            <button
              key={navTab}
              onClick={() => setTab(navTab)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                background: "none",
                border: "none",
                color: isActive ? "#111827" : "#111827",
                cursor: "pointer",
                transition: "color 0.3s ease",
                padding: "8px 0 6px",
                position: "relative",
                ...mono(6),
                textTransform: "uppercase",
              }}
            >
              {/* Active top-line indicator */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: isActive ? 28 : 0,
                  height: 2,
                  background: "#111827",
                  borderRadius: 999,
                  transition: "width 0.35s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
              {/* Icon */}
              <div
                style={{
                  filter: "none",
                  transition: "opacity 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isActive ? 1 : 0.5,
                }}
              >
                <TabIcon tab={navTab} size={17} />
              </div>
              <span
                style={{ letterSpacing: "0.08em", fontSize: 8, lineHeight: 1 }}
              >
                {tabLabel(navTab)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── FLOATING CHATBOT ────────────────────── */}
      <FloatingChatbot />

      {/* ── PROFILE PANEL ─────────────────────────── */}
      <AnimatePresence>
        {showProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 299,
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "none",
              }}
              onClick={() => setShowProfile(false)}
            />
            <ProfilePage
              onClose={() => setShowProfile(false)}
              onLogout={() => {
                setShowProfile(false);
                onLogout();
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
