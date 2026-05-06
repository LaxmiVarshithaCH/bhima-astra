import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import { useWorker } from "../context/WorkerContext";
import { useLanguage } from "../context/LanguageContext";
import { updateWorkerProfile } from "../services/api";

/* ─── Style tokens (mirrors Dashboard typography) ─────────── */
const mono = (size = 9): React.CSSProperties => ({
  fontFamily: "DM Mono, monospace",
  fontSize: size + 4,
  letterSpacing: "0.12em",
});
const editorial = (size = 36): React.CSSProperties => ({
  fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  fontSize: size + 4,
  letterSpacing: "0.03em",
  lineHeight: 1,
});

/* ─── Purple accent (royal purple) ────────────────────────── */
const PURPLE = "rgba(124, 58, 237, 1)";
const PURPLE_MID = "rgba(124, 58, 237, 0.6)";
const PURPLE_LOW = "rgba(124, 58, 237, 0.15)";

/* ─── Admin card wrapper ───────────────────────────────────── */
const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  accentColor?: string;
}> = ({ children, style, accentColor }) => (
  <div
    style={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      ...style,
    }}
  >
    {accentColor && (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: accentColor,
          borderRadius: "12px 12px 0 0",
        }}
      />
    )}
    {children}
  </div>
);

/* ─── Toggle Switch ──────────────────────────────────────── */
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}> = ({ checked, onChange, color = "#7C3AED" }) => (
  <button
    onClick={() => onChange(!checked)}
    aria-checked={checked}
    role="switch"
    style={{
      width: 44,
      height: 24,
      background: checked ? color : "#111827",
      borderRadius: 999,
      border: "none",
      cursor: "pointer",
      position: "relative",
      transition: "background 0.3s ease",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 3,
        left: checked ? 23 : 3,
        width: 18,
        height: 18,
        background: "#fff",
        borderRadius: "50%",
        transition: "left 0.3s ease",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    />
  </button>
);

/* ─── Fraud Risk Score Ring ─────────────────────────────── */
const FraudRingScore: React.FC<{ score: number }> = ({ score }) => {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const pct = score / 100;
  const label =
    score < 35 ? "Low Risk" : score < 65 ? "Medium Risk" : "High Risk";
  const color = score < 35 ? "#22c55e" : score < 65 ? "#FBBF24" : "#FF5C5C";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <svg width={108} height={108} viewBox="0 0 108 108">
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1s ease, stroke 0.4s ease",
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
        <text
          x="54"
          y="50"
          textAnchor="middle"
          fill="#111827"
          fontSize="22"
          fontFamily="'Bebas Neue', sans-serif"
        >
          {score}
        </text>
        <text
          x="54"
          y="64"
          textAnchor="middle"
          fill="#6b7280"
          fontSize="9"
          fontFamily="'DM Mono', monospace"
        >
          /100
        </text>
      </svg>
      <span
        style={{
          ...mono(9),
          color,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PROFILE PAGE COMPONENT
═══════════════════════════════════════════════════════════ */
interface ProfilePageFullProps {
  onLogout: () => void;
}

const ProfilePageFull: React.FC<ProfilePageFullProps> = ({ onLogout }) => {
  /* ── Context ────────────────────────────────────── */
  const { profile, policy, refresh } = useWorker();
  const { lang, setLang, t } = useLanguage();

  /* ── Plan metadata lookup — matches PlansTab constants ─── */
  const PLAN_META: Record<string, { perEventPayout: number; maxWeeklyPayout: number; weeklyPremium: number; maxEvents: number }> = {
    basic:    { perEventPayout: 300,  maxWeeklyPayout: 600,  weeklyPremium: 49,  maxEvents: 2 },
    standard: { perEventPayout: 400,  maxWeeklyPayout: 800,  weeklyPremium: 79,  maxEvents: 2 },
    premium:  { perEventPayout: 600,  maxWeeklyPayout: 1200, weeklyPremium: 119, maxEvents: 2 },
    elite:    { perEventPayout: 800,  maxWeeklyPayout: 1600, weeklyPremium: 149, maxEvents: 3 },
  };

  /* ── State ─────────────────────────────────────── */
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [saveAnim, setSaveAnim] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [upiIds, setUpiIds] = useState<{ id: string; primary: boolean }[]>([]);
  const [newUpi, setNewUpi] = useState("");
  const [showAddUpi, setShowAddUpi] = useState(false);

  // All real zones from the bhima_astra_db workers table
  const ZONES = [
    "Adyar", "Ameerpet", "Andheri-W", "Anna Nagar", "Aundh", "Avadi",
    "Bandra-E", "Baner", "Banjara Hills", "Begumpet", "Bellandur",
    "Borivali-N", "BTM", "C Scheme", "Chinchwad", "Chrompet", "CP",
    "Dadar", "Dilsukhnagar", "Dwarka-Sec10", "Electronic City",
    "Gachibowli", "Goregaon", "Guindy", "Hadapsar", "Hebbal",
    "Hinjewadi", "Hitech City", "HSR Layout", "Indiranagar",
    "Jagatpura", "Janakpuri", "Jhotawara", "JP Nagar", "Karol Bagh",
    "Kondapur", "Kondhwa", "Koramangala", "Kothrud", "Kukatpally",
    "Kurla", "Lajpat Nagar", "LB Nagar", "Malviya Nagar", "Mansarovar",
    "Marathahalli", "Mayur Vihar", "Mehdipatnam", "Mulund", "Murlipura",
    "Mylapore", "Nirman Nagar", "Noida-Sec62", "Perambur", "Pimpri",
    "Pitampura", "Porur", "Powai", "Preet Vihar", "Raja Park",
    "Rajajinagar", "Rohini-Sec3", "Saket", "Sanganer", "Secunderabad",
    "Shivajinagar", "Sholinganallur", "Sodala", "T Nagar", "Tambaram",
    "Thane-W", "Tonk Rd", "Uppal", "Vaishali Nagar", "Vasant Kunj",
    "Velachery", "Vikhroli", "Viman Nagar", "Wakad", "Wanowrie",
    "Whitefield", "Worli", "Yelahanka",
  ];
  const [selectedZone, setSelectedZone] = useState("");

  /* ── Seed form from real profile when it loads ──── */
  useEffect(() => {
    if (!profile) return;
    if (profile.worker_name) setName(profile.worker_name);
    if (profile.phone_number) setPhone(`+91 ${profile.phone_number}`);
    if (profile.city) setCity(profile.city);
    if (profile.geo_zone_id) setSelectedZone(profile.geo_zone_id);
    if (profile.upi_id) {
      setUpiIds([{ id: profile.upi_id, primary: true }]);
    }
  }, [profile]);

  /* ── Fraud score: 0–1 from backend → 0–100 for UI ─ */
  const fraudScoreDisplay =
    profile?.fraud_risk_score != null
      ? Math.round(profile.fraud_risk_score * 100)
      : 28;

  /* ── Derived plan/policy computed values ────────── */
  const tierKey = (policy?.plan_tier ?? "standard").toLowerCase();
  const planMeta = PLAN_META[tierKey] ?? PLAN_META.standard;
  const planDisplayName =
    tierKey.charAt(0).toUpperCase() + tierKey.slice(1);

  // Avatar initials from real worker name
  const avatarInitials = (profile?.worker_name ?? "Worker")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // KYC status from profile
  const isKycVerified = profile?.kyc_verified ?? false;

  // Days until renewal (policy runs 30 days from last_active_date or activation_date)
  const renewalDays = (() => {
    const base = policy?.last_active_date ?? policy?.activation_date;
    if (!base) return null;
    const expiry = new Date(base);
    expiry.setDate(expiry.getDate() + 30);
    const diff = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    return Math.max(0, diff);
  })();

  // Policy number — use real claim_id if available
  const policyNumber = policy?.claim_id
    ? `GS-POL-${String(policy.claim_id).padStart(6, "0")}`
    : `GS-POL-${Math.floor(100000 + Math.random() * 900000)}`;

  // Activation date string
  const activationDateStr = policy?.activation_date
    ? new Date(policy.activation_date).toLocaleDateString("en-IN")
    : new Date().toLocaleDateString("en-IN");

  // Expiry date string
  const expiryDateStr = (() => {
    const base = policy?.last_active_date ?? policy?.activation_date;
    if (!base) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toLocaleDateString("en-IN");
    }
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("en-IN");
  })();

  const [notifs, setNotifs] = useState({
    payout: true,
    whatsapp: true,
    email: false,
    sms: true,
  });

  const LANGS = [
    { code: "EN", name: "English",  flag: "ENG" },
    { code: "TE", name: "తెలుగు",   flag: "TEL" },
    { code: "HI", name: "हिन्दी",   flag: "HIN" },
    { code: "TA", name: "தமிழ்",    flag: "TAM" },
  ];
  // lang / setLang now come from LanguageContext (global)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setSaveAnim(true);
    setSaveError(null);
    try {
      if (profile?.worker_id) {
        await updateWorkerProfile(profile.worker_id, {
          worker_name: name,
          city,
          geo_zone_id: selectedZone,
          upi_id: upiIds.find((u) => u.primary)?.id,
        });
        await refresh();
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes",
      );
    } finally {
      setTimeout(() => setSaveAnim(false), 2000);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const weeklyPremium = policy?.weekly_premium ?? planMeta.weeklyPremium;
    const monthlyPremium = weeklyPremium * 4;
    const perEventPayout = policy?.per_event_payout ?? planMeta.perEventPayout;
    const maxWeeklyPayout = policy?.max_weekly_payout ?? planMeta.maxWeeklyPayout;
    const eventsRemaining = Math.min(policy?.events_remaining ?? planMeta.maxEvents, 2);
    const eventsUsed = Math.min(policy?.events_used ?? 0, 2);
    const policyStatus = policy?.policy_status ?? "active";
    const upiDisplay = upiIds.find((u) => u.primary)?.id ?? profile?.upi_id ?? "Not set";


    // ── Header ─────────────────────────────────────────────────────────────
    doc.setFontSize(22);
    doc.setTextColor(124, 58, 237);
    doc.text("BHIMA ASTRA", 20, 20);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("GigShield Parametric Insurance — Policy Document", 20, 30);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Policy Number: ${policyNumber}`, 20, 40);
    doc.text(`Date of Issue: ${activationDateStr}`, 20, 46);
    doc.text(`Valid Till: ${expiryDateStr}`, 20, 52);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 20, 58);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 64, 190, 64);

    // ── Worker Details ─────────────────────────────────────────────────────
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("Worker Details", 20, 74);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Full Name:    ${name}`, 20, 84);
    doc.text(`Phone:        ${phone || "Not provided"}`, 20, 90);
    doc.text(`Email:        ${email || profile?.email || "Not provided"}`, 20, 96);
    doc.text(`City:         ${city || profile?.city || "Not provided"}`, 20, 102);
    doc.text(`Zone:         ${selectedZone || profile?.geo_zone_id || "Not provided"}`, 20, 108);
    doc.text(`Platform:     ${profile?.platform || "Not provided"}`, 20, 114);
    doc.text(`UPI ID:       ${upiDisplay}`, 20, 120);
    doc.text(`KYC Status:   ${isKycVerified ? "Verified ✓" : "Pending"}`, 20, 126);

    doc.line(20, 132, 190, 132);

    // ── Policy Details ─────────────────────────────────────────────────────
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("Policy Details", 20, 142);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Plan Type:         ${planDisplayName} Plan`, 20, 152);
    doc.text(`Policy Status:     ${policyStatus.toUpperCase()}`, 20, 158);
    doc.text(`Weekly Premium:    INR ${weeklyPremium}`, 20, 164);
    doc.text(`Monthly Premium:   INR ${monthlyPremium}`, 20, 170);
    doc.text(`Events Remaining:  ${eventsRemaining} of ${eventsRemaining + eventsUsed}`, 20, 176);
    doc.text(`Activation Date:   ${activationDateStr}`, 20, 182);
    doc.text(`Expiry Date:       ${expiryDateStr}`, 20, 188);

    doc.line(20, 194, 190, 194);

    // ── Payout Structure ───────────────────────────────────────────────────
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("Parametric Payout Structure", 20, 204);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Per-Event Payout:      INR ${perEventPayout}`, 20, 214);
    doc.text(`Max Weekly Payout:     INR ${maxWeeklyPayout}`, 20, 220);
    doc.text(`Trigger: Rainfall L1 (>= 64.5 mm/day) — INR ${perEventPayout}`, 20, 226);
    doc.text(`Trigger: Rainfall L2 (>= 115.6 mm/day) — INR ${Math.round(perEventPayout * 1.5)}`, 20, 232);
    doc.text(`Trigger: Rainfall L3 (>= 204.5 mm/day) — INR ${maxWeeklyPayout}`, 20, 238);
    doc.text(`Trigger: Heat L1 (>= 40°C) — INR ${perEventPayout}`, 20, 244);
    doc.text(`Trigger: Heat L2 (>= 45°C) — INR ${perEventPayout}`, 20, 250);
    doc.text(`Trigger: AQI >= 300 (CPCB Very Poor) — INR ${perEventPayout}`, 20, 256);
    doc.text(`Trigger: AQI >= 400 (CPCB Severe) — INR ${perEventPayout}`, 20, 262);
    doc.text(`Trigger: Flood / Zone Shutdown — Plan payout`, 20, 268);
    doc.text(`Trigger: Platform Outage / Curfew — Plan payout`, 20, 274);

    // ── Page 2: Exclusions & Terms ──────────────────────────────────────────
    doc.addPage();
    doc.setFontSize(13);
    doc.setTextColor(200, 0, 0);
    doc.text("Exclusions (NOT Covered)", 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(180, 0, 0);
    doc.text("- Wars, armed conflict, and civil unrest (unless manager-verified)", 20, 32);
    doc.text("- Vehicle accidents and personal injury", 20, 38);
    doc.text("- Vehicle damage or theft", 20, 44);
    doc.text("- Income loss due to personal illness", 20, 50);
    doc.text("- Fraud or misrepresentation of location data", 20, 56);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 62, 190, 62);

    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("Claim Process", 20, 72);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text("Payouts are fully parametric — no claims required.", 20, 82);
    doc.text("Triggers fire automatically when IMD / CPCB thresholds are exceeded.", 20, 88);
    doc.text("Funds are credited to your registered UPI ID within 2–4 hours.", 20, 94);

    doc.line(20, 100, 190, 100);
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(`BHIMA ASTRA GigShield | Policy: ${policyNumber} | ${name} | ${city || "India"}`, 20, 110);
    doc.text("This is an auto-generated parametric insurance policy document.", 20, 116);

    doc.save(`BHIMA-ASTRA-Policy-${policyNumber}.pdf`);
  };

  const handleAddUpi = () => {
    if (newUpi.trim() && newUpi.includes("@")) {
      setUpiIds((prev) => [...prev, { id: newUpi.trim(), primary: false }]);
      setNewUpi("");
      setShowAddUpi(false);
    }
  };

  const handleSetPrimary = (targetId: string) => {
    setUpiIds((prev) =>
      prev.map((u) => ({ ...u, primary: u.id === targetId })),
    );
  };

  const handleDeleteUpi = (targetId: string) => {
    setUpiIds((prev) => prev.filter((u) => u.id !== targetId));
  };

  /* ── Input style ───────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "11px 14px",
    color: "#111827",
    ...mono(10),
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  const labelStyle: React.CSSProperties = {
    ...mono(8),
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    marginBottom: 6,
    display: "block",
  };

  return (
    <div style={{ padding: "0 0 80px", color: "#111827" }}>
      {/* ── Inline styles for this page ──────────── */}
      <style>{`
        .profile-input:focus {
          border-color: #7C3AED !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .profile-page-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .profile-page-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (min-width: 1200px) {
          .profile-page-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
        .profile-header-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 24px;
          padding: 36px 40px 32px;
        }
        @media (min-width: 768px) {
          .profile-header-row {
            flex-direction: row;
            align-items: center;
          }
        }
        .upi-chip {
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .upi-chip:hover { background: #f3f0ff !important; border-color: rgba(124,58,237,0.3) !important; }
        .zone-chip {
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius: 999px;
          padding: 7px 16px;
          font-size: 9px;
          letter-spacing: 0.12em;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          color: #111827;
        }
        .zone-chip.active {
          background: rgba(124,58,237,0.1) !important;
          border-color: rgba(124,58,237,0.5) !important;
          color: #7C3AED !important;
        }
        .profile-logout-btn:hover {
          background: rgba(255,92,92,0.06) !important;
          border-color: rgba(255,92,92,0.6) !important;
        }
        .profile-delete-btn:hover {
          background: rgba(255,92,92,0.08) !important;
        }
        .lang-card {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lang-card.selected {
          border-color: rgba(124,58,237,0.5) !important;
          background: rgba(124,58,237,0.07) !important;
        }
        .lang-card:hover:not(.selected) {
          border-color: #111827 !important;
          background: #f9fafb !important;
        }
      `}</style>

      {/* ══════════════════════════════════════════
          HEADER CARD
      ══════════════════════════════════════════ */}
      <GlassCard accentColor={PURPLE} style={{ marginBottom: 24 }}>
        <div className="profile-header-row">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${PURPLE_LOW}, rgba(37,117,252,0.12))`,
              border: `1px solid ${PURPLE_MID}`,
              boxShadow: `0 0 20px ${PURPLE_LOW}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              ...editorial(26),
              color: PURPLE,
            }}
          >
            {avatarInitials}
          </motion.div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{ ...editorial(32), color: "#111827", marginBottom: 4 }}
            >
              {name}
            </div>
            <div style={{ ...mono(9), color: "#111827", marginBottom: 10 }}>
              {email}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span
                className="badge"
                style={{
                  background: PURPLE_LOW,
                  border: `1px solid ${PURPLE_MID}`,
                  color: PURPLE,
                  borderRadius: 999,
                  padding: "3px 12px",
                  ...mono(8),
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                ✦ {planDisplayName} Plan
              </span>
              {isKycVerified && (
                <span className="badge badge-green">
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "currentColor",
                    }}
                  />
                  KYC Verified
                </span>
              )}
              {!isKycVerified && (
                <span className="badge badge-amber">KYC Pending</span>
              )}
              {renewalDays !== null && renewalDays <= 10 && (
                <span className="badge badge-amber">Renew in {renewalDays}d</span>
              )}
              {renewalDays !== null && renewalDays > 10 && (
                <span
                  className="badge"
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    color: "#166534",
                    borderRadius: 999,
                    padding: "3px 12px",
                  }}
                >
                  Active · {renewalDays}d left
                </span>
              )}
            </div>

            <div>
              <button
                onClick={generatePDF}
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: "#111827",
                  ...mono(9),
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#9ca3af";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <polyline points="9 15 12 18 15 15"></polyline>
                </svg>
                {t('download_pdf')}
              </button>
            </div>
          </div>

          {/* Fraud Risk on the right */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ ...mono(8), color: "#111827", textTransform: "uppercase", letterSpacing: "0.16em" }}>
              {t('fraud_risk')}
            </span>
            <FraudRingScore score={fraudScoreDisplay} />
          </div>
        </div>
      </GlassCard>

      {/* ══════════════════════════════════════════
          MAIN GRID
      ══════════════════════════════════════════ */}
      <div className="profile-page-grid">
        {/* ── Personal Information ─────────────── */}
        <GlassCard accentColor="#60A5FA" style={{ padding: "28px 24px" }}>
          <div
            style={{ ...mono(8), color: "#111827", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 20 }}
          >
            {t('personal_info')}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: t('full_name'), val: name, set: setName, key: "name" },
              { label: t('phone'),     val: phone, set: setPhone, key: "phone" },
              { label: t('email'),     val: email, set: setEmail, key: "email" },
              { label: t('city'),      val: city,  set: setCity,  key: "city" },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label style={labelStyle}>{label}</label>
                <input
                  className="profile-input"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <motion.button
            className={saveAnim ? "btn-outline" : "btn-primary"}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            style={{
              marginTop: 20,
              width: "100%",
              justifyContent: "center",
              ...(saveAnim
                ? {
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "#fff",
                  borderColor: "rgba(34,197,94,0.4)",
                }
                : {}),
            }}
          >
            {saveAnim ? t('saved') : t('save_changes')}
          </motion.button>
          {saveError && (
            <div
              style={{
                marginTop: 8,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#FF5C5C",
                letterSpacing: "0.08em",
              }}
            >
              ⚠ {saveError}
            </div>
          )}
        </GlassCard>

        {/* ── UPI Accounts ─────────────────────── */}
        <GlassCard accentColor="#00D1B2" style={{ padding: "28px 24px" }}>
          <div style={{ ...mono(8), color: "#111827", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 20 }}>
            {t('upi_accounts')}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <AnimatePresence>
              {upiIds.map(({ id, primary }) => (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="upi-chip"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: primary ? PURPLE_LOW : "#f9fafb",
                    border: primary
                      ? `1px solid ${PURPLE_MID}`
                      : "1px solid #e5e7eb",
                    borderRadius: 10,
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        ...mono(10),
                        color: "#111827",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {id}
                    </div>
                    {primary && (
                      <div
                        style={{
                          ...mono(7),
                          color: PURPLE,
                          marginTop: 2,
                          textTransform: "uppercase",
                          letterSpacing: "0.14em",
                        }}
                      >
                        {t('primary')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!primary && (
                      <button
                        onClick={() => handleSetPrimary(id)}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#111827",
                          cursor: "pointer",
                          ...mono(7),
                          transition: "all 0.2s",
                        }}
                      >
                        {t('set_primary')}
                      </button>
                    )}
                    {!primary && (
                      <button
                        onClick={() => handleDeleteUpi(id)}
                        style={{
                          background: "#fff5f5",
                          border: "1px solid rgba(255,92,92,0.3)",
                          borderRadius: 6,
                          padding: "4px 8px",
                          width: 30,
                          color: "#FF5C5C",
                          cursor: "pointer",
                          ...mono(7),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showAddUpi && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden", marginBottom: 10 }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="profile-input"
                    value={newUpi}
                    onChange={(e) => setNewUpi(e.target.value)}
                    placeholder="yourname@upi"
                    style={{ ...inputStyle, flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddUpi();
                    }}
                  />
                  <button
                    onClick={handleAddUpi}
                    style={{
                      background: `linear-gradient(135deg, ${PURPLE}, #2575fc)`,
                      border: "none",
                      borderRadius: 8,
                      padding: "0 14px",
                      color: "#fff",
                      cursor: "pointer",
                      ...mono(9),
                      flexShrink: 0,
                    }}
                  >
                    {t('add')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setShowAddUpi((v) => !v)}
            style={{
              width: "100%",
              background: "none",
              border: `1px dashed rgba(124,58,237,0.35)`,
              borderRadius: 10,
              padding: "10px",
              color: "#A78BFA",
              cursor: "pointer",
              ...mono(9),
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              transition: "all 0.2s ease",
            }}
          >
            {showAddUpi ? t('cancel') : t('add_upi')}
          </button>
        </GlassCard>

        {/* ── Zone Settings ────────────────────── */}
        <GlassCard accentColor="#FBBF24" style={{ padding: "28px 24px" }}>
          <div style={{ ...mono(8), color: "#111827", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 20 }}>
            {t('zone_settings')}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {ZONES.map((zone) => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`zone-chip ${selectedZone === zone ? "active" : ""}`}
                style={{
                  background:
                    selectedZone === zone ? "rgba(124,58,237,0.1)" : "#f9fafb",
                  border:
                    selectedZone === zone
                      ? "1px solid rgba(124,58,237,0.5)"
                      : "1px solid #d1d5db",
                  color: selectedZone === zone ? PURPLE : "#111827",
                  borderRadius: 999,
                  padding: "7px 16px",
                  ...mono(8),
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                {zone}
              </button>
            ))}
          </div>
          <motion.button
            className="btn-primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {t('update_zone')}
          </motion.button>
        </GlassCard>

        {/* ── Notifications ────────────────────── */}
        <GlassCard accentColor="#22c55e" style={{ padding: "28px 24px" }}>
          <div style={{ ...mono(8), color: "#111827", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 20 }}>
            {t('notifications')}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {([
              { key: "payout",   label: t('payout_alerts'),  desc: t('payout_alerts_desc') },
              { key: "whatsapp", label: t('whatsapp'),        desc: t('whatsapp_desc') },
              { key: "email",    label: t('email_notif'),     desc: t('email_notif_desc') },
              { key: "sms",      label: t('sms'),             desc: t('sms_desc') },
            ] as Array<{ key: keyof typeof notifs; label: string; desc: string }>).map(({ key, label, desc }) => (
              <div
                key={key}
                className="data-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                }}
              >
                <div>
                  <div
                    style={{ ...mono(10), color: "#111827", marginBottom: 3 }}
                  >
                    {label}
                  </div>
                  <div style={{ ...mono(8), color: "#111827" }}>{desc}</div>
                </div>
                <Toggle
                  checked={notifs[key]}
                  onChange={(v) => setNotifs((prev) => ({ ...prev, [key]: v }))}
                />
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ── Language ─────────────────────────── */}
        <GlassCard accentColor="#60A5FA" style={{ padding: "28px 24px" }}>
          <div style={{ ...mono(8), color: "#111827", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 20 }}>
            {t('language')}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {LANGS.map(({ code, name, flag }) => (
              <button
                key={code}
                onClick={() => setLang(code as import('../context/LanguageContext').LangCode)}
                className={`lang-card ${lang === code ? "selected" : ""}`}
                style={{
                  background:
                    lang === code ? "rgba(124,58,237,0.07)" : "#f9fafb",
                  border:
                    lang === code
                      ? "1px solid rgba(124,58,237,0.5)"
                      : "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "14px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 22 }}>{flag}</span>
                <div
                  style={{
                    ...mono(9),
                    color: lang === code ? PURPLE : "#111827",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  {code}
                </div>
                <div
                  style={{
                    ...mono(8),
                    color: lang === code ? PURPLE : "#111827",
                  }}
                >
                  {name}
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ── Danger Zone ──────────────────────── */}
        <GlassCard
          style={{
            padding: "28px 24px",
            border: "1px solid rgba(255,92,92,0.25)",
          }}
        >
          <div style={{ ...mono(8), color: "#FF5C5C", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 8 }}>
            {t('danger_zone')}
          </div>
          <div style={{ ...mono(9), color: "#111827", marginBottom: 20, lineHeight: 1.7 }}>
            {t('danger_desc')}
          </div>

          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden", marginBottom: 12 }}
              >
                <div
                  style={{
                    background: "#fff5f5",
                    border: "1px solid rgba(255,92,92,0.3)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    marginBottom: 0,
                  }}
                >
                  <div style={{ ...mono(9), color: "#FF5C5C", marginBottom: 10 }}>
                    {t('delete_confirm')}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        flex: 1,
                        background: "#fff0f0",
                        border: "1px solid rgba(255,92,92,0.4)",
                        borderRadius: 8,
                        padding: "10px",
                        color: "#FF5C5C",
                        cursor: "pointer",
                        ...mono(8),
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                      }}
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{
                        flex: 1,
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "10px",
                        color: "#111827",
                        cursor: "pointer",
                        ...mono(8),
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            className="profile-delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              width: "100%",
              background: "rgba(255,92,92,0.05)",
              border: "1px solid rgba(255,92,92,0.3)",
              borderRadius: 10,
              padding: "12px",
              color: "#FF5C5C",
              cursor: "pointer",
              ...mono(9),
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              transition: "all 0.25s ease",
            }}
          >
            {t('delete_account')}
          </button>
        </GlassCard>
      </div>

      {/* ══════════════════════════════════════════
          LOGOUT BUTTON (bottom)
      ══════════════════════════════════════════ */}
      <div style={{ marginTop: 30 }}>
        <motion.button
          className="profile-logout-btn"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogout}
          style={{
            width: "100%",
            background: "none",
            border: "1px solid rgba(255,92,92,0.3)",
            borderRadius: 12,
            padding: "16px",
            color: "#FF5C5C",
            cursor: "pointer",
            ...mono(10),
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            transition: "all 0.25s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </motion.button>
      </div>
    </div>
  );
};

export default ProfilePageFull;
