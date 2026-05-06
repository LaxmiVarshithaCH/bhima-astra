import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { formatINR } from "../utils/currency";

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

/* ─── Fetch Hooks & Logic ─── */
function usePolledWeather() {
  const [data, setData] = useState({
    rain: 0,
    aqi: 0,
    heatIndex: 0,
    loaded: false,
    error: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [weatherRes, aqiRes] = await Promise.all([
          fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=Vijayawada,IN&appid=${import.meta.env.VITE_WEATHER_API_KEY}&units=metric`,
          ).catch(() => null),
          fetch(
            `https://api.waqi.info/feed/geo:16.5062;80.6480/?token=${import.meta.env.VITE_WAQI_TOKEN}`,
          ).catch(() => null),
        ]);

        let tempRain = 0,
          tempHeat = 0,
          tempAqi = 0;

        if (weatherRes && weatherRes.ok) {
          const wData = await weatherRes.json();
          tempRain = wData.rain?.["1h"] ?? 0;
          tempHeat = wData.main?.feels_like ?? wData.main?.temp ?? 0;
        }

        if (aqiRes && aqiRes.ok) {
          const aData = await aqiRes.json();
          if (
            aData.status === "ok" &&
            aData.data &&
            aData.data.aqi !== undefined
          ) {
            tempAqi = aData.data.aqi;
          }
        }

        setData({
          rain: Math.round(tempRain * 10) / 10,
          aqi: Math.round(tempAqi),
          heatIndex: Math.round(tempHeat),
          loaded: true,
          error: false,
        });
      } catch (e) {
        setData((prev) => ({ ...prev, error: true, loaded: true }));
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, []);

  return data;
}

// Logic Utilities
const getStatus = (
  val: number,
  threshold: number,
): "COVERED" | "NEAR" | "TRIGGER READY" => {
  if (val >= threshold) return "TRIGGER READY";
  if (val >= threshold * 0.8) return "NEAR";
  return "COVERED";
};

const getRainColor = (val: number, threshold: number) => {
  if (val >= threshold) return "#06b6d4";
  return "#60A5FA";
};

const getAqiColor = (val: number) => {
  if (val >= 150) return "#FF5C5C";
  if (val >= 100) return "#FBBF24";
  return "#22c55e";
};

const getHeatColor = (val: number, threshold: number) => {
  if (val >= threshold) return "#FF5C5C";
  if (val >= threshold * 0.8) return "#f97316";
  return "#FBBF24";
};

/* ─── Main Component ─── */
const PolicyPage: React.FC = () => {
  const { rain, aqi, heatIndex, loaded, error } = usePolledWeather();

  // Threshold Constants
  const T_RAIN = 25;
  const T_AQI = 200;
  const T_HEAT = 42;

  // Render Status Badge Logic
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "TRIGGER READY":
        return (
          <span
            className="badge badge-red"
            style={{ animation: "pulse-slow 2s infinite" }}
          >
            Ready
          </span>
        );
      case "NEAR":
        return <span className="badge badge-amber">Near</span>;
      case "COVERED":
        return <span className="badge badge-green">Covered</span>;
      default:
        return (
          <span style={{ ...mono(8), color: "#111827" }}>Not Included</span>
        );
    }
  };

  return (
    <div
      className="policy-page-wrap"
      style={{
        width: "100%",
        maxWidth: "none",
        minHeight: "100vh",
        padding: "0 32px 60px",
      }}
    >
      <style>{`
        @keyframes pulse-slow {
          0% { box-shadow: 0 0 0 0 rgba(255,92,92,0.4); }
          70% { box-shadow: 0 0 0 6px rgba(255,92,92,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,92,92,0); }
        }
        .progress-bar-transition {
          transition: width 1s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.5s ease;
        }
        @media (max-width: 1200px) {
          .policy-page-wrap { padding: 0 24px 60px !important; }
        }
        @media (max-width: 768px) {
          .policy-page-wrap { padding: 0 16px 48px !important; }
          .policy-two-col { grid-template-columns: 1fr !important; }
          .policy-trigger-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .policy-trigger-grid { min-width: 520px; }
          .policy-hero-card { padding: 24px 20px !important; flex-direction: column !important; gap: 20px !important; }
          .policy-dates-row { flex-direction: row !important; flex-wrap: wrap !important; gap: 16px !important; }
          .policy-btn-row { flex-direction: column !important; }
          .policy-btn-row button, .policy-btn-row a { width: 100% !important; justify-content: center !important; text-align: center !important; }
          .policy-renew-btn { margin-left: 0 !important; width: 100% !important; }
        }
      `}</style>

      {/* SECTION 1 — Policy Hero Card */}
      <Section>
        <div
          className="pcard pcard-green policy-hero-card"
          style={{
            padding: "32px 36px",
            display: "flex",
            flexWrap: "wrap",
            gap: 40,
            alignItems: "flex-start",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            className="hero-glow"
            style={{
              width: 300,
              height: 300,
              background: "#22c55e",
              top: -80,
              left: -60,
            }}
          />

          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div className="badge badge-green">✓ Active</div>
            </div>
            <div
              style={{ ...editorial(48), color: "#111827", marginBottom: 6 }}
            >
              Bhima Astra Policy
            </div>
            <div
              style={{
                ...mono(10),
                color: "#111827",
                letterSpacing: "0.08em",
                opacity: 0.8,
              }}
            >
              Policy No. WRK-2401-XZ
            </div>
          </div>

          <div
            className="policy-dates-row"
            style={{
              display: "flex",
              gap: 32,
              minWidth: 200,
              padding: "20px 24px",
              background: "#f9fafb",
              border: "1px solid #111827",
              borderRadius: 12, // Border changed to #111827
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  ...mono(7),
                  textTransform: "uppercase",
                  color: "#111827",
                  marginBottom: 8,
                  letterSpacing: "0.16em",
                  opacity: 0.7,
                }}
              >
                Activated Date
              </div>
              <div style={{ ...editorial(28), color: "#111827" }}>
                01 Jan 2026
              </div>
            </div>
            <div>
              <div
                style={{
                  ...mono(7),
                  textTransform: "uppercase",
                  color: "#111827",
                  marginBottom: 8,
                  letterSpacing: "0.16em",
                  opacity: 0.7,
                }}
              >
                Expiry Date
              </div>
              <div style={{ ...editorial(28), color: "#FBBF24" }}>
                30 Apr 2026
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* SECTION 2 — Two Column Grid */}
      <div
        className="policy-two-col"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
          marginBottom: 40,
          alignItems: "stretch",
        }}
      >
        {/* LEFT COLUMN — Coverage Triggers Card */}
        <Section delay={0.05} style={{ marginBottom: 0, height: "100%" }}>
          <div
            className="pcard"
            style={{ padding: "28px 30px", height: "100%" }}
          >
            <div
              style={{
                ...mono(9),
                color: "#111827",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                marginBottom: 24,
                opacity: 0.8,
              }}
            >
              Coverage Triggers
            </div>
            <div className="policy-trigger-table">
              <div
                className="policy-trigger-grid"
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 1fr",
                    gap: 10,
                    borderBottom: "1px solid #111827",
                    paddingBottom: 10,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Trigger
                  </span>
                  <span
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Threshold
                  </span>
                  <span
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Payout
                  </span>
                  <span
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      textAlign: "center",
                    }}
                  >
                    Level
                  </span>
                  <span
                    style={{
                      ...mono(7),
                      color: "#111827",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      textAlign: "right",
                    }}
                  >
                    Status
                  </span>
                </div>
                {/* Rows */}
                {[
                  {
                    trigger: "Rainfall",
                    threshold: "> 25 mm/hr",
                    payout: formatINR(600),
                    level: "L2",
                    levelColor: "#60A5FA",
                    status: getStatus(rain, T_RAIN),
                  },
                  {
                    trigger: "AQI",
                    threshold: "> 200",
                    payout: formatINR(600),
                    level: "L1",
                    levelColor: "#FBBF24",
                    status: getStatus(aqi, T_AQI),
                  },
                  {
                    trigger: "Heat Index",
                    threshold: "> 42°C",
                    payout: formatINR(600),
                    level: "L1",
                    levelColor: "#FBBF24",
                    status: getStatus(heatIndex, T_HEAT),
                  },
                  {
                    trigger: "Cyclone",
                    threshold: "Category 2+",
                    payout: formatINR(1200),
                    level: "L3",
                    levelColor: "#A78BFA",
                    status: "Covered",
                  },
                  {
                    trigger: "Hailstorm",
                    threshold: "> 15 mm",
                    payout: formatINR(600),
                    level: "L2",
                    levelColor: "#60A5FA",
                    status: "Not Included",
                  },
                ].map((t) => (
                  <div
                    key={t.trigger}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 1fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 0",
                    }}
                  >
                    <span style={{ ...mono(9), color: "#111827" }}>
                      {t.trigger}
                    </span>
                    <span
                      style={{ ...mono(8), color: "#111827", opacity: 0.8 }}
                    >
                      {t.threshold}
                    </span>
                    <span style={{ ...editorial(22), color: "#111827" }}>
                      {t.payout}
                    </span>
                    <div style={{ textAlign: "center" }}>
                      <span
                        style={{
                          ...mono(8),
                          color: t.levelColor,
                          background: `${t.levelColor}15`,
                          border: `1px solid ${t.levelColor}30`,
                          padding: "3px 8px",
                          borderRadius: 4,
                          display: "inline-block",
                        }}
                      >
                        {t.level}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {!loaded && !error ? (
                        <span style={{ ...mono(8), color: "#111827" }}>
                          ...
                        </span>
                      ) : (
                        renderStatusBadge(t.status)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
            height: "100%",
          }}
        >
          {/* RIGHT COLUMN — Event Cap Card */}
          <Section delay={0.08} style={{ marginBottom: 0 }}>
            <div className="pcard pcard-amber" style={{ padding: "32px 28px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    ...mono(9),
                    color: "#111827",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    opacity: 0.8,
                  }}
                >
                  Event Cap
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ ...editorial(46), color: "#111827" }}>
                  1<span style={{ color: "#111827" }}>/3</span>
                </div>
                <div
                  style={{
                    ...mono(9),
                    color: "#111827",
                    textTransform: "uppercase",
                    opacity: 0.8,
                  }}
                >
                  Used
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  ...mono(8),
                  color: "#111827",
                  opacity: 0.7,
                }}
              >
                Max payout:{" "}
                <span style={{ color: "#111827", fontWeight: 600 }}>
                  {formatINR(1800)}
                </span>{" "}
                this month
              </div>
            </div>
          </Section>

          {/* RIGHT COLUMN — Live Thresholds Card */}
          <Section
            delay={0.11}
            style={{
              marginBottom: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="pcard"
              style={{
                padding: "32px 28px",
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    ...mono(9),
                    color: "#111827",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    opacity: 0.8,
                  }}
                >
                  Live Thresholds
                </div>
                <div className="badge badge-blue">
                  <div
                    className="pulse-dot"
                    style={{
                      width: 6,
                      height: 6,
                      background: "currentColor",
                      borderRadius: "50%",
                    }}
                  />
                  Live Data
                </div>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {/* Rainfall Bar */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ ...mono(9), color: "#111827" }}>
                      Rainfall
                    </span>
                    <span
                      style={{ ...mono(9), color: getRainColor(rain, T_RAIN) }}
                    >
                      {loaded ? `${rain} / ${T_RAIN} mm` : "-- / 25 mm"}
                    </span>
                  </div>
                  <div
                    className="progress-track"
                    style={{ height: 4, background: "#11182720" }}
                  >
                    <div
                      className="progress-bar-transition"
                      style={{
                        width: `${Math.min((rain / T_RAIN) * 100, 100)}%`,
                        height: "100%",
                        background: getRainColor(rain, T_RAIN),
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* AQI Bar */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ ...mono(9), color: "#111827" }}>AQI</span>
                    <span style={{ ...mono(9), color: getAqiColor(aqi) }}>
                      {loaded ? `${aqi} / ${T_AQI}` : "-- / 200"}
                    </span>
                  </div>
                  <div
                    className="progress-track"
                    style={{ height: 4, background: "#11182720" }}
                  >
                    <div
                      className="progress-bar-transition"
                      style={{
                        width: `${Math.min((aqi / T_AQI) * 100, 100)}%`,
                        height: "100%",
                        background: getAqiColor(aqi),
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* Heat Index Bar */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ ...mono(9), color: "#111827" }}>
                      Heat Index
                    </span>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      {Array.from([getStatus(heatIndex, T_HEAT)]).map((s) =>
                        s === "NEAR" ? (
                          <span
                            key={s}
                            className="badge badge-amber"
                            style={{ fontSize: 9, padding: "1px 6px" }}
                          >
                            Near!
                          </span>
                        ) : s === "TRIGGER READY" ? (
                          <span
                            key={s}
                            className="badge badge-red"
                            style={{ fontSize: 9, padding: "1px 6px" }}
                          >
                            Ready!
                          </span>
                        ) : null,
                      )}
                      <span
                        style={{
                          ...mono(9),
                          color: getHeatColor(heatIndex, T_HEAT),
                        }}
                      >
                        {loaded ? `${heatIndex} / ${T_HEAT}°C` : "-- / 42°C"}
                      </span>
                    </div>
                  </div>
                  <div
                    className="progress-track"
                    style={{ height: 4, background: "#11182720" }}
                  >
                    <div
                      className="progress-bar-transition"
                      style={{
                        width: `${Math.min((heatIndex / T_HEAT) * 100, 100)}%`,
                        height: "100%",
                        background: getHeatColor(heatIndex, T_HEAT),
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* SECTION 3 — Exclusions Card */}
      <Section delay={0.14}>
        <div
          className="pcard"
          style={{
            padding: "28px 32px",
            background: "rgba(255,92,92,0.06)",
            border: "1px solid rgba(255,92,92,0.15)",
          }}
        >
          <div
            style={{
              ...mono(9),
              color: "#FF5C5C",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              marginBottom: 20,
            }}
          >
            Policy Exclusions
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            {[
              "Scheduled Maintenance",
              "Personal Illness",
              "Voluntary Offline",
              "Fraud Activity",
              "Acts of War",
            ].map((exclusion) => (
              <div
                key={exclusion}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF5C5C"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                </svg>
                <span
                  style={{
                    ...mono(14),
                    color: "#111827",
                    fontWeight: 500,
                    letterSpacing: "0.3px",
                  }}
                >
                  {exclusion}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* SECTION 4 — Bottom Buttons */}
      <Section delay={0.17}>
        <div
          className="policy-btn-row"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            borderTop: "1px solid #111827",
            paddingTop: 32,
            alignItems: "center",
            opacity: 1,
          }}
        >
          <button
            className="btn-outline btn-sliding-lines"
            style={{ color: "#111827", borderColor: "#111827" }}
          >
            Download Policy PDF
          </button>
          <button
            className="btn-outline btn-sliding-lines"
            style={{ color: "#FF5C5C", borderColor: "rgba(255,92,92,0.3)" }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,92,92,0.08)";
              e.currentTarget.style.borderColor = "rgba(255,92,92,0.6)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.borderColor = "rgba(255,92,92,0.3)";
            }}
          >
            Cancel Policy
          </button>

          <motion.div
            className="policy-renew-btn"
            style={{ marginLeft: "auto" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <button className="btn-primary btn-sliding-lines">
              Renew Policy →
            </button>
          </motion.div>
        </div>
      </Section>
    </div>
  );
};

export default PolicyPage;
