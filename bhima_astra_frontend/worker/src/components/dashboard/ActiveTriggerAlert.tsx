import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { formatINR } from "../../utils/currency";
import { useWorker } from "../../context/WorkerContext";

interface Props {
  isActive?: boolean;
}

const ActiveTriggerAlert: React.FC<Props> = ({ isActive }) => {
  const { zoneLive } = useWorker();
  const navigate = useNavigate();

  // Show if prop explicitly true, or if zone reports trigger recommended
  const shouldShow =
    isActive === true || zoneLive?.trigger_recommended === true;

  if (!shouldShow) return null;

  const mono = { fontFamily: "DM Mono, monospace" } as React.CSSProperties;
  const editorial = {
    fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
    letterSpacing: "0.01em",
    lineHeight: 1,
  } as React.CSSProperties;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px -30% 0px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: "100%",
        border: "1px solid #e5e7eb",
        borderLeft: "3px solid #FF5C5C",
        borderRadius: 16,
        background: "#ffffff",
        padding: "20px 26px 20px 28px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      {/* Left red accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 3,
          height: "100%",
          background: "linear-gradient(180deg, #FF5C5C, rgba(255,92,92,0.3))",
          borderRadius: "16px 0 0 16px",
        }}
      />

      {/* Background gradient sweep — hidden on light theme */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        {/* Pulse dot */}
        <div
          className="glow-red"
          style={{
            width: 10,
            height: 10,
            background: "#FF5C5C",
            borderRadius: "50%",
            flexShrink: 0,
          }}
        />

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 5,
            }}
          >
            <span
              style={{
                ...mono,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#FF5C5C",
              }}
            >
              ACTIVE TRIGGER
            </span>
            <span className="badge badge-red">RAINFALL</span>
          </div>
          <div
            style={{
              ...editorial,
              fontSize: 22,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            Heavy Rainfall Threshold Exceeded
          </div>
          <div
            style={{
              ...mono,
              fontsize: 11,
              color: "#111827",
              letterSpacing: "0.04em",
            }}
          >
            {zoneLive?.zone_id ?? "Your Zone"} · Risk:{" "}
            {zoneLive?.zone_risk_score != null
              ? Math.round(zoneLive.zone_risk_score * 100)
              : "—"}
            /100 · Monitor active
          </div>
        </div>

        {/* Right side — payout + fraud + CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                ...mono,
                fontsize: 10,
                color: "#111827",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Est. Payout
            </div>
            <div style={{ ...editorial, fontSize: 30, color: "#111827" }}>
              {formatINR(2000)}
            </div>
          </div>
          <div>
            <div
              style={{
                ...mono,
                fontsize: 10,
                color: "#111827",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Fraud Status
            </div>
            <div
              style={{
                ...mono,
                fontSize: 11,
                color: "#16a34a",
                letterSpacing: "0.08em",
              }}
            >
              CLEAN ✓
            </div>
          </div>
          <motion.button
            whileHover={{
              background: "#FF5C5C",
              color: "#fff",
              boxShadow: "0 0 24px rgba(255,92,92,0.4)",
            }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              navigate("/payouts?event=rainfall");
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }, 500);
            }}
            style={{
              background: "none",
              border: "1px solid rgba(255,92,92,0.5)",
              color: "#FF5C5C",
              ...mono,
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "10px 20px",
              cursor: "pointer",
              transition: "all 0.2s",
              borderRadius: 8,
            }}
          >
            View Claim →
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ActiveTriggerAlert;
