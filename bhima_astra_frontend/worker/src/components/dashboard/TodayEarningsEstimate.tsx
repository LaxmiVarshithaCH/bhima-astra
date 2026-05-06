import React from "react";
import { motion } from "framer-motion";
import { formatINR } from "../../utils/currency";
import { useWorker } from "../../context/WorkerContext";

const mono = { fontFamily: "DM Mono, monospace" } as React.CSSProperties;
const editorial = {
  fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  letterSpacing: "0.02em",
  lineHeight: 1,
} as React.CSSProperties;

const TodayEarningsEstimate: React.FC = () => {
  const { earningsEstimate, loading } = useWorker();

  const data = {
    expectedOrders: earningsEstimate?.expected_orders ?? 18,
    expectedIncome: earningsEstimate?.expected_income ?? 1440,
    actualIncome: earningsEstimate?.actual_income_today ?? 980,
    incomeGap: earningsEstimate?.income_gap ?? 460,
  };

  if (loading && !earningsEstimate) {
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
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            color: "#111827",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Today's Earnings
        </div>
        <div
          style={{
            height: 20,
            background: "#f3f4f6",
            borderRadius: 4,
            marginBottom: 8,
            width: "60%",
          }}
        />
        <div
          style={{
            height: 60,
            background: "#f3f4f6",
            borderRadius: 4,
            marginBottom: 8,
            width: "40%",
          }}
        />
      </div>
    );
  }

  const pct = Math.round((data.actualIncome / data.expectedIncome) * 100);

  return (
    <motion.div
      style={{
        padding: "28px 30px",
        display: "flex",
        flexDirection: "column",
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
      transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <span
          style={{
            ...mono,
            fontsize: 12,
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#111827",
          }}
        >
          Today's Earnings
        </span>
        <span
          style={{
            ...mono,
            fontsize: 11,
            color: "#059669",
            letterSpacing: "0.06em",
          }}
        >
          {pct}% of target
        </span>
      </div>

      {/* Big actual figure */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            ...mono,
            fontsize: 12,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Actual Income So Far
        </div>
        <div style={{ ...editorial, fontSize: 68, color: "#111827" }}>
          {formatINR(data.actualIncome)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div className="progress-track" style={{ height: 4, marginBottom: 8 }}>
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.3, delay: 0.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              background: "linear-gradient(90deg, #00D1B2, #22c55e)",
              borderRadius: 999,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ ...mono, fontsize: 12, color: "#111827" }}>
            {formatINR(0)}
          </span>
          <span style={{ ...mono, fontsize: 12, color: "#111827" }}>
            {formatINR(data.expectedIncome)} target
          </span>
        </div>
      </div>

      {/* Metrics 3-col */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderTop: "1px solid #f3f4f6",
        }}
      >
        {[
          {
            label: "Exp. Orders",
            value: `${data.expectedOrders}`,
            color: "#111827",
          },
          {
            label: "Exp. Income",
            value: formatINR(data.expectedIncome),
            color: "#111827",
          },
          {
            label: "Income Gap",
            value: `-${formatINR(data.incomeGap)}`,
            color: "#FF5C5C",
          },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: "14px 0",
              paddingLeft: i > 0 ? 14 : 0,
              borderLeft: i > 0 ? "1px solid #f3f4f6" : "none",
            }}
          >
            <div
              style={{
                ...mono,
                fontsize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#111827",
                marginBottom: 6,
              }}
            >
              {item.label}
            </div>
            <div style={{ ...editorial, fontSize: 22, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default TodayEarningsEstimate;
