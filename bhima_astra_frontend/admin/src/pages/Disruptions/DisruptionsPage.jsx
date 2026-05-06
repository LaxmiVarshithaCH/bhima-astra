import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { AnimatePresence, motion } from "framer-motion";

import Panel from "../../components/Panel";
import {
  getAllFlags,
  getAllZonesWeather,
  getCityWeather,
  getManagerFlags,
  adminVerifyFlag,
  adminRejectFlag,
  getLiveTriggers,
} from "../../lib/adminApi";

function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function rainfallSeverity(rainfall_mm) {
  if (rainfall_mm > 200) return "L3";
  if (rainfall_mm > 100) return "L2";
  return "L1";
}

function aqiSeverity(aqi_value) {
  if (aqi_value > 400) return "L3";
  if (aqi_value > 300) return "L2";
  return "L1";
}

function computedSeverity({ aqi, rainfall, temperature }) {
  if (aqi > 400) return "L3";
  if (aqi > 300) return "L2";
  if (rainfall > 200) return "L3";
  if (rainfall > 100) return "L2";
  if (temperature > 40) return "L2";
  return "L1";
}

function impactLevel(sev) {
  if (sev === "L3") return "High";
  if (sev === "L2") return "Medium";
  return "Low";
}

function severityBadge(sev) {
  if (sev === "L3") return "text-[#EF4444] font-semibold";
  if (sev === "L2") return "text-[#F59E0B]";
  return "text-[#111827]";
}

function yesNo(v) {
  return v ? "YES" : "NO";
}

function zoneSeverityBase(sev) {
  if (sev === "L3") return 3;
  if (sev === "L2") return 2;
  return 1;
}

const MANAGER_DISRUPTION_TYPES = ["curfew", "protest", "strike"];

const PALETTE = {
  primary: "#2563EB",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  neutral: "#6B7280",
};

const PASTEL = {
  warmBerry: "#85586F",
  softRaspberry: "#AC7D88",
  paleOrange: "#DEB6AB",
  sunKissed: "#F8EDE3",
  lavender: "#957DAD",
  skyBlue: "#A7D3DF",
  mediumLilac: "#C9BBCF",
  mutedPurple: "#898AA6",
  thistlePink: "#E0B8B4",
  candyPink: "#FEC8D8",
  milkyPink: "#FFDFD3",
};

function randomDisruptionType() {
  return pick(MANAGER_DISRUPTION_TYPES);
}

function disruptionImpact(sev) {
  if (sev === "L3") return "High";
  if (sev === "L2") return "Medium";
  return "Low";
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(offset) {
  const d = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return DAY_ABBR[d.getDay()];
}

function generateForecastCards(days) {
  const seed = {
    max: randInt(34, 40),
    min: randInt(24, 29),
  };

  return Array.from({ length: days }, (_, i) => {
    const wave = Math.sin((i / Math.max(1, days - 1)) * Math.PI * 2);
    const max = clamp(Math.round(seed.max + wave * 2 + randInt(-1, 1)), 28, 44);
    const min = clamp(
      Math.round(seed.min + wave * 2 + randInt(-1, 1)),
      18,
      max - 3,
    );
    const roll = randInt(1, 100);
    const type = roll > 74 ? "rain" : roll > 42 ? "cloudy" : "sunny";
    return { day: dayLabel(i), max, min, type };
  });
}

function WeatherIcon({ type }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "rain") {
    return (
      <svg {...common} aria-hidden="true" style={{ stroke: "#3B82F6" }}>
        <path d="M20 16.5a4.5 4.5 0 0 0-1.7-8.6A6 6 0 0 0 6 9.5a4.5 4.5 0 0 0 0 9h12" />
        <path d="M8 19l-1 2" />
        <path d="M12 19l-1 2" />
        <path d="M16 19l-1 2" />
      </svg>
    );
  }

  if (type === "cloudy") {
    return (
      <svg {...common} aria-hidden="true" style={{ stroke: "#94A3B8" }}>
        <path d="M20 16.5a4.5 4.5 0 0 0-1.7-8.6A6 6 0 0 0 6 9.5a4.5 4.5 0 0 0 0 9h12" />
      </svg>
    );
  }

  return (
    <svg {...common} aria-hidden="true" style={{ stroke: "#F59E0B" }}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M6.34 17.66l-1.41 1.41" />
      <path d="M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export default function DisruptionsPage() {
  const [weatherData, setWeatherData] = useState(() => ({
    rainfall_mm: 0,
    flood_flag: false,
    temperature: 0,
    heatwave_flag: false,
  }));

  const [aqiData, setAqiData] = useState(() => ({ aqi_value: 0 }));

  // Start empty — will be populated from real API zones below
  const [zoneDisruptions, setZoneDisruptions] = useState([]);

  const [disruptionStatus, setDisruptionStatus] = useState([]);
  const [realZonesLoaded, setRealZonesLoaded] = useState(false);

  // ── Manager flags state (separate from zone disruptions) ────────────────
  const [managerFlags, setManagerFlags] = useState([]);
  const [flagActionInProgress, setFlagActionInProgress] = useState(null);

  // ── Real weather state ───────────────────────────────────────────────────
  const [realWeatherLoaded, setRealWeatherLoaded] = useState(false);

  // Fetch real weather + populate zone disruptions from API
  useEffect(() => {
    const fetchRealWeather = async () => {
      try {
        const zones = await getAllZonesWeather();
        if (zones && zones.length > 0) {
          // Average across zones for display
          const avgRainfall =
            zones.reduce((s, z) => s + (z.rainfall_mm || 0), 0) / zones.length;
          const avgTemp =
            zones.reduce((s, z) => s + (z.temperature_c || 30), 0) /
            zones.length;
          const avgAqi =
            zones.reduce((s, z) => s + (z.aqi || 100), 0) / zones.length;
          const anyFlood = zones.some((z) => z.flood_flag);
          const anyHeat = zones.some((z) => z.heatwave_flag);

          setWeatherData({
            rainfall_mm: Math.round(avgRainfall),
            temperature: Math.round(avgTemp),
            flood_flag: anyFlood,
            heatwave_flag: anyHeat,
          });
          setAqiData({ aqi_value: Math.round(avgAqi) });
          setRealWeatherLoaded(true);

          // Build zone disruptions from real zone data
          if (!realZonesLoaded) {
            const zoneRows = zones.map((z) => {
              const rf = z.rainfall_mm || 0;
              const temp = z.temperature_c || 30;
              const aqi = z.aqi || 100;
              const sev = rf > 100 || aqi > 300 ? "L2" : rf > 200 || aqi > 400 ? "L3" : "L1";
              return {
                zone: z.city || z.zone_id || "Unknown",
                severity: sev,
                impact: sev === "L3" ? "High" : sev === "L2" ? "Medium" : "Low",
                disruption_type: rf > 100 ? "rainfall" : aqi > 200 ? "aqi" : temp > 40 ? "heat" : "curfew",
                manager_flag: z.flood_flag || z.heatwave_flag || false,
                manager_override: false,
              };
            });
            setZoneDisruptions(zoneRows);
            setRealZonesLoaded(true);
          }
        }
      } catch (err) {
        console.warn("[DisruptionsPage] Real weather fetch failed:", err);
      }
    };

    fetchRealWeather();
    // Refresh every 15 minutes
    const interval = window.setInterval(fetchRealWeather, 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Fetch disruption flags from API on mount
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const data = await getAllFlags();
        if (data && data.length > 0) {
          // Transform API data to match zoneDisruptions format
          const flagsAsDisruptions = data.map((flag) => ({
            zone: flag.zone_id || "Zone A",
            severity: flag.flag_status === "verified" ? "L2" : "L1",
            impact: flag.flag_status === "verified" ? "Medium" : "Low",
            disruption_type: flag.disruption_type || "curfew",
            manager_flag: flag.payout_enabled || false,
            manager_override: false,
          }));

          // Merge with existing zones, prioritizing API data
          setZoneDisruptions((prev) => {
            const zones = new Map(prev.map((z) => [z.zone, z]));
            flagsAsDisruptions.forEach((f) => {
              zones.set(f.zone, { ...zones.get(f.zone), ...f });
            });
            return Array.from(zones.values());
          });
        }
      } catch (error) {
        console.warn(
          "[DisruptionsPage] Failed to fetch flags from API:",
          error,
        );
      }
    };

    fetchFlags();
  }, []);

  // Fetch manager flags (separate list for admin review panel)
  useEffect(() => {
    const fetchManagerFlags = async () => {
      try {
        const data = await getManagerFlags();
        if (data && data.length > 0) {
          setManagerFlags(data);
        }
      } catch (err) {
        console.warn("[DisruptionsPage] Manager flags fetch failed:", err);
      }
    };
    fetchManagerFlags();
  }, []);

  // Handle admin verify/reject on manager flag
  const handleManagerFlagAction = useCallback(
    async (flagId, action) => {
      setFlagActionInProgress(flagId);
      try {
        const result =
          action === "verify"
            ? await adminVerifyFlag(flagId)
            : await adminRejectFlag(flagId);

        if (result && result.status !== "error") {
          setManagerFlags((prev) =>
            prev.map((f) =>
              f.flag_id === flagId
                ? {
                    ...f,
                    flag_status: action === "verify" ? "verified" : "rejected",
                    admin_verified: true,
                    payout_enabled: action === "verify",
                  }
                : f,
            ),
          );
          setToast({
            zone: managerFlags.find((f) => f.flag_id === flagId)?.zone_id || "",
            action: action === "verify" ? "Flag Verified" : "Flag Rejected",
          });
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(null), 2000);
        }
      } catch (err) {
        console.warn("[DisruptionsPage] Flag action failed:", err);
      } finally {
        setFlagActionInProgress(null);
      }
    },
    [managerFlags],
  );

  // Populate disruptionStatus from real live triggers (no hardcoded boot values)
  useEffect(() => {
    const fetchLiveTriggers = async () => {
      try {
        const triggers = await getLiveTriggers();
        if (triggers && triggers.length > 0) {
          const rows = triggers.map((t) => ({
            id: t.id || `D-${Date.now().toString(36)}`,
            zone: t.zone || "Unknown",
            status: t.status || "active",
            started_at: t.timestamp || new Date().toISOString(),
          }));
          setDisruptionStatus(rows);
        }
      } catch (err) {
        console.warn("[DisruptionsPage] Live triggers fetch failed:", err);
      }
    };
    fetchLiveTriggers();
    const t = window.setInterval(fetchLiveTriggers, 30000);
    return () => window.clearInterval(t);
  }, []);

  const derived = useMemo(() => {
    const weatherSeverity = rainfallSeverity(weatherData.rainfall_mm);
    const aqiSev = aqiSeverity(aqiData.aqi_value);

    const activeZone = zoneDisruptions.filter((z) => z.manager_flag);
    const resolvedZone = zoneDisruptions.filter((z) => !z.manager_flag);
    const explicitlyResolved = [];

    return {
      weatherSeverity,
      aqiSev,
      activeZone,
      resolvedZone,
      explicitlyResolved,
    };
  }, [
    aqiData.aqi_value,
    disruptionStatus,
    weatherData.rainfall_mm,
    weatherData.temperature,
    zoneDisruptions,
  ]);

  const globalDisruptions = useMemo(() => {
    const rainfallSev = rainfallSeverity(weatherData.rainfall_mm);
    const heatSev =
      weatherData.temperature > 44
        ? "L3"
        : weatherData.temperature > 40
          ? "L2"
          : "L1";
    const floodSev = weatherData.flood_flag
      ? weatherData.rainfall_mm > 200
        ? "L3"
        : weatherData.rainfall_mm > 120
          ? "L2"
          : "L1"
      : "L1";
    const aqiSev = aqiSeverity(aqiData.aqi_value);

    const byType = (type) =>
      zoneDisruptions.filter((z) => z.disruption_type === type);

    // ── CHANGED: returns array of zone names instead of a joined string ──
    const zonesForType = (type) => {
      return byType(type)
        .filter((z) => zoneSeverityBase(z.severity) >= 2)
        .map((z) => z.zone);
    };

    const maxSev = (rows) => {
      const n = Math.max(0, ...rows.map((r) => zoneSeverityBase(r.severity)));
      return n === 3 ? "L3" : n === 2 ? "L2" : "L1";
    };
    const statusForType = (type) => {
      const rows = byType(type);
      const s = maxSev(rows);
      return rows.length > 0 && zoneSeverityBase(s) >= 2;
    };

    const curfewSev = maxSev(byType("curfew"));
    const protestSev = maxSev(byType("protest"));
    const strikeSev = maxSev(byType("strike"));

    // Use real zone IDs from loaded zone data instead of hardcoded labels
    const ALL_ZONES = zoneDisruptions.map((z) => z.zone);

    return [
      {
        name: "rainfall",
        severity: rainfallSev,
        impact: impactLevel(rainfallSev),
        status: weatherData.rainfall_mm > 20,
        // ── CHANGED: array instead of string ──
        zones: weatherData.rainfall_mm > 20 ? ALL_ZONES : [],
      },
      {
        name: "heat",
        severity: heatSev,
        impact: impactLevel(heatSev),
        status: weatherData.heatwave_flag,
        // ── CHANGED: array instead of string ──
        zones: weatherData.heatwave_flag ? ALL_ZONES : [],
      },
      {
        name: "flood",
        severity: floodSev,
        impact: impactLevel(floodSev),
        status: weatherData.flood_flag,
        // ── CHANGED: array instead of string ──
        zones: weatherData.flood_flag ? ALL_ZONES : [],
      },
      {
        name: "AQI",
        severity: aqiSev,
        impact: impactLevel(aqiSev),
        status: aqiData.aqi_value >= 100,
        // ── CHANGED: array instead of string ──
        zones: aqiData.aqi_value >= 100 ? ALL_ZONES : [],
      },
      {
        name: "curfew",
        severity: curfewSev,
        impact: impactLevel(curfewSev),
        status: statusForType("curfew"),
        zones: zonesForType("curfew"),
      },
      {
        name: "protest",
        severity: protestSev,
        impact: impactLevel(protestSev),
        status: statusForType("protest"),
        zones: zonesForType("protest"),
      },
      {
        name: "strike",
        severity: strikeSev,
        impact: impactLevel(strikeSev),
        status: statusForType("strike"),
        zones: zonesForType("strike"),
      },
    ];
  }, [
    aqiData.aqi_value,
    weatherData.flood_flag,
    weatherData.heatwave_flag,
    weatherData.rainfall_mm,
    weatherData.temperature,
    zoneDisruptions,
  ]);

  const [forecast7d, setForecast7d] = useState([]);
  const [forecast15d, setForecast15d] = useState([]);
  const [show15, setShow15] = useState(false);
  const [activeForecastIdx, setActiveForecastIdx] = useState(0);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    // Fetch real forecast from OWM via backend
    const BASE = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
    const fetchForecastFromApi = async (days) => {
      try {
        const url = `${BASE}/api/v1/forecast/days`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const cards = data.slice(0, days).map((d) => ({
            day: d.day || d.forecast_date || "?",
            max: d.temp ? parseInt(d.temp.split("/")[0]) : 30,
            min: d.temp ? parseInt(d.temp.split("/")[1]) : 22,
            type:
              (d.condition || "").toLowerCase().includes("rain") ? "rain"
              : (d.condition || "").toLowerCase().includes("cloud") ? "cloudy"
              : "sunny",
          }));
          return cards;
        }
      } catch (err) {
        console.warn("[DisruptionsPage] Forecast API failed, using generated fallback:", err);
      }
      // Realistic generated fallback based on today's date
      return generateForecastCards(days);
    };
    fetchForecastFromApi(7).then(setForecast7d);
    fetchForecastFromApi(15).then(setForecast15d);
  }, []);

  const currentCondition = useMemo(() => {
    if (weatherData.heatwave_flag) return "heatwave";
    if (weatherData.rainfall_mm > 90) return "rain";
    if (weatherData.rainfall_mm > 20) return "cloudy";
    return "sunny";
  }, [weatherData.heatwave_flag, weatherData.rainfall_mm]);

  const weatherTheme = useMemo(() => {
    if (currentCondition === "heatwave") {
      return { accent: PALETTE.danger, bg: "weather-bg--heatwave" };
    }
    if (currentCondition === "rain") {
      return { accent: "#3B82F6", bg: "weather-bg--rain" };
    }
    if (currentCondition === "cloudy") {
      return { accent: "#64748B", bg: "weather-bg--cloudy" };
    }
    return { accent: "#F59E0B", bg: "weather-bg--sunny" };
  }, [currentCondition]);

  const aqiTheme = useMemo(() => {
    if (aqiData.aqi_value >= 300) {
      return {
        tone: "poor",
        accent: PALETTE.danger,
        bgClass: "bg-[#FFF5F5]",
        badgeClass: "border-[#EF4444] text-[#EF4444] bg-[#FEF2F2]",
        numberClass: "text-[#EF4444]",
      };
    }

    if (aqiData.aqi_value >= 100) {
      return {
        tone: "moderate",
        accent: PALETTE.warning,
        bgClass: "bg-[#FFFBF0]",
        badgeClass: "border-[#F59E0B] text-[#92400E] bg-[#FEF3C7]",
        numberClass: "text-[#F59E0B]",
      };
    }

    return {
      tone: "good",
      accent: PALETTE.success,
      bgClass: "bg-[#F0FFF8]",
      badgeClass: "border-[#22C55E] text-[#166534] bg-[#DCFCE7]",
      numberClass: "text-[#22C55E]",
    };
  }, [aqiData.aqi_value]);

  const aqiBgClass = aqiTheme.bgClass;

  const pollutantCards = useMemo(() => {
    const base = clamp(aqiData.aqi_value, 0, 500);
    const pm25 = clamp(Math.round(base * 0.22 + 8), 0, 250);
    const pm10 = clamp(Math.round(base * 0.32 + 12), 0, 400);
    const no2 = clamp(Math.round(base * 0.18 + 6), 0, 200);
    const o3 = clamp(Math.round(base * 0.15 + 10), 0, 220);

    return [
      { label: "PM2.5", value: pm25, unit: "µg/m³" },
      { label: "PM10", value: pm10, unit: "µg/m³" },
      { label: "NO2", value: no2, unit: "ppb" },
      { label: "O3", value: o3, unit: "ppb" },
    ];
  }, [aqiData.aqi_value]);

  const setManagerFlag = (zone, nextFlag) => {
    setToast({ zone, action: nextFlag ? "Accepted" : "Rejected" });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1400);
    setZoneDisruptions((prev) =>
      prev.map((z) =>
        z.zone === zone
          ? { ...z, manager_flag: nextFlag, manager_override: true }
          : z,
      ),
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 text-[#111827]"
    >
      <div>
        <h1 className="font-display text-[24px] font-semibold tracking-tight text-[#111827]">
          Disruptions
        </h1>
        <div className="mt-1 text-[12px] text-[#6B7280]">
          Monitor real-time disruptions from weather, AQI, and manager flags
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-[980px]">
          <Panel
            title="FORECAST"
            subtitle={show15 ? "15-day outlook" : "7-day outlook"}
            className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
            headerClassName="border-b border-[#E5E7EB]"
            bodyClassName="p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-[#6B7280]">
                {show15 ? "15-day forecast" : "7-day forecast"}
              </div>

              <div className="flex items-center rounded-full border border-[#E5E7EB] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <button
                  type="button"
                  onClick={() => setShow15(false)}
                  className={
                    "rounded-full px-3 py-1 text-[10px] uppercase tracking-wider transition-colors " +
                    (show15
                      ? "text-[#6B7280] hover:bg-[#F1F5F9]"
                      : "bg-[#EEF2FF] text-[#1E3A8A]")
                  }
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setShow15(true)}
                  className={
                    "rounded-full px-3 py-1 text-[10px] uppercase tracking-wider transition-colors " +
                    (show15
                      ? "bg-[#EEF2FF] text-[#1E3A8A]"
                      : "text-[#6B7280] hover:bg-[#F1F5F9]")
                  }
                >
                  15 Days
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <div className="flex justify-center">
                <div className="flex gap-2 min-w-max">
                  {(() => {
                    const data = show15 ? forecast15d : forecast7d;

                    if (data.length === 0) {
                      return Array.from({ length: show15 ? 15 : 7 }).map(
                        (_, idx) => (
                          <div
                            key={`sk-${idx}`}
                            className="w-[92px] flex-shrink-0 rounded-2xl border border-[#E5E7EB] bg-[#F1F5F9] px-3 py-3 text-center"
                          >
                            <div className="h-[12px] w-8 mx-auto rounded bg-[#E2E8F0]" />
                            <div className="mt-3 h-[28px] w-[28px] mx-auto rounded-full bg-[#E2E8F0]" />
                            <div className="mt-3 h-[12px] w-12 mx-auto rounded bg-[#E2E8F0]" />
                          </div>
                        ),
                      );
                    }

                    return data.map((d, idx) => {
                      const isActive = idx === activeForecastIdx;
                      const riskTone =
                        d.type === "rain"
                          ? "bg-[#3B82F6]"
                          : d.type === "cloudy"
                            ? "bg-[#94A3B8]"
                            : "bg-[#F59E0B]";

                      return (
                        <motion.button
                          type="button"
                          key={`${d.day}-${idx}`}
                          onClick={() => setActiveForecastIdx(idx)}
                          whileHover={{ y: -3, scale: 1.02 }}
                          transition={{ duration: 0.22 }}
                          className={
                            "w-[104px] flex-shrink-0 rounded-2xl border px-3 py-3 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-colors duration-300 ease-in-out " +
                            (isActive
                              ? "border-[#2563EB] bg-white"
                              : "border-[#E5E7EB] bg-[#F8FAFC] hover:bg-white")
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className={
                                "text-[10px] uppercase tracking-wider " +
                                (isActive ? "text-[#1E3A8A]" : "text-[#6B7280]")
                              }
                            >
                              {d.day}
                            </div>
                            <div
                              className={"h-2 w-2 rounded-full " + riskTone}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="mt-2 flex items-center justify-center">
                            <WeatherIcon type={d.type} />
                          </div>

                          <div className="mt-2 text-[12px] text-[#111827] tabular-nums">
                            <span className="font-semibold">{d.max}°</span>
                            <span className="text-[#9CA3AF]"> / {d.min}°</span>
                          </div>

                          <div className="mt-2 text-[10px] text-[#6B7280]">
                            Risk
                          </div>
                        </motion.button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 right-6 z-[9999]"
          >
            <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
              <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                Zone flag
              </div>
              <div className="mt-1 text-[12px] text-[#111827]">
                <span className="font-semibold">{toast.zone}</span> ·{" "}
                {toast.action}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="WEATHER"
          subtitle="rainfall · flood · temperature · heatwave"
          className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          headerClassName="border-b border-[#E5E7EB]"
          bodyClassName="relative overflow-hidden"
        >
          <div
            className={`pointer-events-none absolute inset-0 opacity-[0.28] transition-colors duration-300 ease-in-out weather-anim ${weatherTheme.bg}`}
          />
          {currentCondition === "sunny" && (
            <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full weather-sun" />
          )}
          {currentCondition === "cloudy" && (
            <>
              <div className="pointer-events-none absolute top-6 -left-10 h-16 w-36 rounded-full weather-cloud" />
              <div className="pointer-events-none absolute top-16 left-20 h-12 w-28 rounded-full weather-cloud weather-cloud--2" />
              <div className="pointer-events-none absolute top-10 right-6 h-14 w-32 rounded-full weather-cloud weather-cloud--3" />
            </>
          )}
          {currentCondition === "rain" && (
            <>
              <div className="pointer-events-none absolute top-10 left-6 h-14 w-32 rounded-full weather-cloud weather-cloud--dark" />
              <div className="pointer-events-none absolute top-14 right-8 h-16 w-36 rounded-full weather-cloud weather-cloud--dark weather-cloud--3" />
              <div className="pointer-events-none absolute inset-0 weather-rain" />
            </>
          )}
          {currentCondition === "heatwave" && (
            <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full weather-heat" />
          )}

          <div className="relative p-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Now
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <div className="text-[56px] leading-none font-semibold tabular-nums text-[#111827]">
                    {weatherData.temperature}°
                  </div>
                  <div className="pb-1">
                    <div
                      className="text-[12px] font-medium"
                      style={{ color: weatherTheme.accent }}
                    >
                      {currentCondition === "heatwave"
                        ? "Heatwave"
                        : currentCondition === "rain"
                          ? "Rain"
                          : currentCondition === "cloudy"
                            ? "Cloudy"
                            : "Sunny"}
                    </div>
                    <div className="text-[11px] text-[#6B7280]">Condition</div>
                  </div>
                </div>
              </div>

              <div className="rounded-full border border-[#E5E7EB] bg-white/70 px-3 py-1 text-[10px] uppercase tracking-wider text-[#374151] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                Live
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Rainfall
                </div>
                <div
                  className="mt-1 text-[14px] font-semibold tabular-nums"
                  style={{ color: weatherTheme.accent }}
                >
                  {weatherData.rainfall_mm} mm
                </div>
                <div
                  className="mt-1 text-[10px] uppercase tracking-wider"
                  style={{ color: weatherTheme.accent }}
                >
                  {derived.weatherSeverity}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Flood risk
                </div>
                <div className="mt-1 text-[14px] font-semibold tabular-nums text-[#111827]">
                  {yesNo(weatherData.flood_flag)}
                </div>
                <div className="mt-1 text-[11px] text-[#9CA3AF]">
                  Derived from rainfall
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Temperature
                </div>
                <div
                  className="mt-1 text-[14px] font-semibold tabular-nums"
                  style={{ color: weatherTheme.accent }}
                >
                  {weatherData.temperature}°C
                </div>
                <div className="mt-1 text-[11px] text-[#9CA3AF]">
                  Live reading
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Heatwave
                </div>
                <div
                  className="mt-1 text-[14px] font-semibold tabular-nums"
                  style={{
                    color: weatherData.heatwave_flag
                      ? PALETTE.danger
                      : "#111827",
                  }}
                >
                  {yesNo(weatherData.heatwave_flag)}
                </div>
                <div className="mt-1 text-[11px] text-[#9CA3AF]">
                  threshold &gt; 40°C
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="AQI"
          subtitle="Air Quality Index"
          className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          headerClassName="border-b border-[#E5E7EB]"
          bodyClassName="relative overflow-hidden"
        >
          <div
            className={`pointer-events-none absolute inset-0 opacity-[0.24] transition-colors duration-300 ease-in-out aqi-anim ${
              aqiTheme.tone === "poor"
                ? "aqi-bg--poor"
                : aqiTheme.tone === "moderate"
                  ? "aqi-bg--moderate"
                  : "aqi-bg--good"
            }`}
          />
          <div className="relative p-4">
            <div className="flex items-start justify-between">
              <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                Air quality
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider transition-colors duration-300 ease-in-out ${aqiTheme.badgeClass}`}
              >
                {aqiTheme.tone === "poor"
                  ? "Unhealthy"
                  : aqiTheme.tone === "moderate"
                    ? "Moderate"
                    : "Good"}
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center">
              <div
                className={`text-[72px] leading-none font-semibold tabular-nums transition-colors duration-300 ease-in-out ${aqiTheme.numberClass}`}
              >
                {aqiData.aqi_value}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-[#9CA3AF]">
                AQI index
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Range
                </div>
                <div className="mt-1 text-[12px] text-[#374151]">
                  0–100 / 100–300 / 300+
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                  Status
                </div>
                <div className="mt-1 text-[12px] text-[#374151]">
                  {aqiTheme.tone === "poor"
                    ? "Poor"
                    : aqiTheme.tone === "moderate"
                      ? "Moderate"
                      : "Good"}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {pollutantCards.map((p) => (
                <div
                  key={p.label}
                  className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4"
                >
                  <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                    {p.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <div
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: aqiTheme.accent }}
                    >
                      {p.value}
                    </div>
                    <div className="text-[10px] text-[#9CA3AF]">{p.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <style>{`
        .weather-anim {
          background-size: 180% 180%;
          animation: softGradient 12s ease-in-out infinite;
        }

        .aqi-anim {
          background-size: 180% 180%;
          animation: softGradient 14s ease-in-out infinite;
        }

        @keyframes softGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .wx {
          position: relative;
          width: 28px;
          height: 28px;
          display: inline-block;
        }

        .wx--sunny {
          animation: wxFloat 4.6s ease-in-out infinite;
        }
        .wx-sun {
          position: absolute;
          inset: 5px;
          border-radius: 999px;
          background: radial-gradient(
            circle at 30% 30%,
            rgba(255, 255, 255, 0.7),
            rgba(253, 184, 19, 1) 45%,
            rgba(253, 184, 19, 0.88) 72%
          );
          box-shadow: 0 0 16px rgba(253, 184, 19, 0.45);
          animation: wxSunPulse 3.6s ease-in-out infinite;
        }
        .wx-face {
          position: absolute;
          inset: 9px;
        }
        .wx-eye {
          position: absolute;
          top: 6px;
          width: 3px;
          height: 4px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.62);
          animation: wxBlink 5.8s ease-in-out infinite;
        }
        .wx-eye--l {
          left: 5px;
        }
        .wx-eye--r {
          right: 5px;
        }
        .wx-smile {
          position: absolute;
          left: 50%;
          bottom: 4px;
          width: 10px;
          height: 6px;
          transform: translateX(-50%);
          border: 2px solid rgba(17, 17, 17, 0.52);
          border-top: none;
          border-left: none;
          border-right: none;
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
          opacity: 0.9;
        }
        .wx-ray {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2px;
          height: 6px;
          background: rgba(253, 184, 19, 0.95);
          transform-origin: 1px 16px;
          border-radius: 2px;
          opacity: 0.9;
          animation: wxRays 4.8s linear infinite;
        }
        .wx-ray--1 {
          transform: translate(-50%, -50%) rotate(0deg) translateY(-15px);
        }
        .wx-ray--2 {
          transform: translate(-50%, -50%) rotate(45deg) translateY(-15px);
        }
        .wx-ray--3 {
          transform: translate(-50%, -50%) rotate(90deg) translateY(-15px);
        }
        .wx-ray--4 {
          transform: translate(-50%, -50%) rotate(135deg) translateY(-15px);
        }
        .wx-ray--5 {
          transform: translate(-50%, -50%) rotate(180deg) translateY(-15px);
        }
        .wx-ray--6 {
          transform: translate(-50%, -50%) rotate(225deg) translateY(-15px);
        }
        .wx-ray--7 {
          transform: translate(-50%, -50%) rotate(270deg) translateY(-15px);
        }
        .wx-ray--8 {
          transform: translate(-50%, -50%) rotate(315deg) translateY(-15px);
        }

        .wx--cloudy {
          animation: wxFloat 5.8s ease-in-out infinite;
        }
        .wx-cloud {
          position: absolute;
          left: 4px;
          right: 4px;
          top: 10px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(244, 247, 255, 0.92),
            rgba(148, 163, 184, 0.75)
          );
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.16);
          animation: wxCloudDrift 6.6s ease-in-out infinite;
        }
        .wx-cloud::before {
          content: "";
          position: absolute;
          left: 3px;
          top: -6px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: inherit;
        }
        .wx-cloud::after {
          content: "";
          position: absolute;
          right: 4px;
          top: -8px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: inherit;
        }
        .wx-cloud--back {
          top: 8px;
          opacity: 0.55;
          filter: blur(0.2px);
          animation-duration: 8.8s;
          transform: scale(0.92);
        }

        .wx--rain {
          animation: wxFloat 5.2s ease-in-out infinite;
        }
        .wx--rain .wx-cloud {
          left: 3px;
          right: 3px;
          top: 9px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(60, 75, 105, 0.62),
            rgba(35, 45, 70, 0.72)
          );
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.22);
          animation: wxCloudDrift 7.2s ease-in-out infinite;
        }
        .wx-drop {
          position: absolute;
          top: 18px;
          width: 2px;
          height: 8px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.95);
          opacity: 0.9;
          animation: wxRain 0.95s linear infinite;
        }
        .wx-drop--1 {
          left: 8px;
          animation-delay: 0s;
        }
        .wx-drop--2 {
          left: 14px;
          animation-delay: 0.18s;
        }
        .wx-drop--3 {
          left: 20px;
          animation-delay: 0.36s;
        }

        @keyframes wxRain {
          0% {
            transform: translateY(0px);
            opacity: 0;
          }
          20% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(8px);
            opacity: 0;
          }
        }
        @keyframes wxFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-1.5px);
          }
        }
        @keyframes wxSunPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.035);
          }
        }
        @keyframes wxRays {
          0% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.8;
          }
        }
        @keyframes wxCloudDrift {
          0%,
          100% {
            transform: translateX(-1px);
          }
          50% {
            transform: translateX(2px);
          }
        }
        @keyframes wxBlink {
          0%,
          95%,
          100% {
            transform: scaleY(1);
          }
          96% {
            transform: scaleY(0.15);
          }
          97% {
            transform: scaleY(1);
          }
        }

        .weather-bg--sunny {
          background:
            radial-gradient(
              circle at 18% 22%,
              rgba(254, 215, 170, 0.6),
              transparent 56%
            ),
            radial-gradient(
              circle at 74% 30%,
              rgba(253, 184, 19, 0.28),
              transparent 58%
            ),
            linear-gradient(
              135deg,
              rgba(255, 251, 235, 1),
              rgba(255, 255, 255, 0.95)
            );
          background-size: 180% 180%;
          animation: weatherBgDrift 8.5s ease-in-out infinite;
        }
        .weather-bg--cloudy {
          background:
            radial-gradient(
              circle at 22% 30%,
              rgba(186, 230, 253, 0.55),
              transparent 58%
            ),
            radial-gradient(
              circle at 72% 65%,
              rgba(226, 232, 240, 0.55),
              transparent 62%
            ),
            linear-gradient(
              135deg,
              rgba(248, 250, 252, 1),
              rgba(255, 255, 255, 0.95)
            );
          background-size: 180% 180%;
          animation: weatherBgDrift 11s ease-in-out infinite;
        }
        .weather-bg--rain {
          background:
            radial-gradient(
              circle at 24% 30%,
              rgba(147, 197, 253, 0.38),
              transparent 60%
            ),
            radial-gradient(
              circle at 72% 70%,
              rgba(186, 230, 253, 0.5),
              transparent 62%
            ),
            linear-gradient(
              135deg,
              rgba(239, 246, 255, 1),
              rgba(255, 255, 255, 0.95)
            );
          background-size: 180% 180%;
          animation: weatherBgDrift 9.5s ease-in-out infinite;
        }
        .weather-bg--heatwave {
          background:
            radial-gradient(
              circle at 18% 25%,
              rgba(254, 202, 202, 0.5),
              transparent 60%
            ),
            radial-gradient(
              circle at 62% 30%,
              rgba(253, 186, 116, 0.42),
              transparent 62%
            ),
            linear-gradient(
              135deg,
              rgba(255, 247, 237, 1),
              rgba(255, 255, 255, 0.95)
            );
          background-size: 180% 180%;
          animation: weatherBgDrift 8.5s ease-in-out infinite;
        }
        @keyframes weatherBgDrift {
          0%,
          100% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 100%;
          }
        }
        .weather-sun {
          background: radial-gradient(
            circle at 30% 30%,
            rgba(253, 184, 19, 0.28),
            rgba(253, 184, 19, 0.1),
            transparent 72%
          );
          animation: weatherSunPulse 6.5s ease-in-out infinite;
        }
        .weather-heat {
          background: radial-gradient(
            circle at 30% 30%,
            rgba(239, 68, 68, 0.22),
            rgba(239, 68, 68, 0.08),
            transparent 72%
          );
          animation: weatherSunPulse 6s ease-in-out infinite;
        }
        @keyframes weatherSunPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }
        .weather-cloud {
          background: rgba(241, 245, 249, 0.8);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          animation: weatherCloudDrift 18s linear infinite;
        }
        .weather-cloud--dark {
          background: rgba(148, 163, 184, 0.22);
        }
        .weather-cloud--2 {
          animation-duration: 24s;
          opacity: 0.6;
        }
        .weather-cloud--3 {
          animation-duration: 28s;
          opacity: 0.65;
        }
        @keyframes weatherCloudDrift {
          0% {
            transform: translateX(-12px);
          }
          50% {
            transform: translateX(18px);
          }
          100% {
            transform: translateX(-12px);
          }
        }
        .weather-rain {
          background-image: repeating-linear-gradient(
            115deg,
            rgba(59, 130, 246, 0) 0px,
            rgba(59, 130, 246, 0) 10px,
            rgba(59, 130, 246, 0.12) 11px,
            rgba(59, 130, 246, 0.12) 12px
          );
          opacity: 0.3;
          animation: weatherRainFall 1.6s linear infinite;
        }
        @keyframes weatherRainFall {
          0% {
            background-position: 0px 0px;
          }
          100% {
            background-position: 0px 80px;
          }
        }

        .aqi-bg--good {
          background:
            radial-gradient(
              circle at 30% 35%,
              rgba(34, 197, 94, 0.22),
              transparent 58%
            ),
            radial-gradient(
              circle at 70% 65%,
              rgba(34, 197, 94, 0.1),
              transparent 62%
            ),
            linear-gradient(
              135deg,
              rgba(240, 255, 248, 0.92),
              rgba(255, 255, 255, 0.9)
            );
          background-size: 200% 200%;
          animation: aqiDrift 8.8s ease-in-out infinite;
        }
        .aqi-bg--moderate {
          background:
            radial-gradient(
              circle at 28% 38%,
              rgba(245, 158, 11, 0.2),
              transparent 58%
            ),
            radial-gradient(
              circle at 72% 62%,
              rgba(245, 158, 11, 0.1),
              transparent 62%
            ),
            linear-gradient(
              135deg,
              rgba(255, 251, 235, 0.92),
              rgba(255, 255, 255, 0.9)
            );
          background-size: 200% 200%;
          animation: aqiDrift 8.8s ease-in-out infinite;
        }
        .aqi-bg--poor {
          background:
            radial-gradient(
              circle at 30% 35%,
              rgba(239, 68, 68, 0.18),
              transparent 58%
            ),
            radial-gradient(
              circle at 74% 66%,
              rgba(239, 68, 68, 0.1),
              transparent 64%
            ),
            linear-gradient(
              135deg,
              rgba(255, 245, 245, 0.92),
              rgba(255, 255, 255, 0.9)
            );
          background-size: 200% 200%;
          animation: aqiDrift 8.8s ease-in-out infinite;
        }
        @keyframes aqiDrift {
          0%,
          100% {
            background-position: 0% 0%;
            filter: saturate(1.02);
          }
          50% {
            background-position: 100% 100%;
            filter: saturate(1.12);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wx--sunny,
          .wx--cloudy,
          .wx--rain,
          .weather-bg--sunny,
          .weather-bg--cloudy,
          .weather-bg--rain,
          .weather-bg--heatwave,
          .weather-sun,
          .weather-heat,
          .weather-cloud,
          .weather-rain,
          .aqi-bg--good,
          .aqi-bg--moderate,
          .aqi-bg--poor {
            animation: none !important;
          }
        }
      `}</style>

      <Panel
        title="GLOBAL DISRUPTIONS"
        subtitle="AUTO-DETECTED"
        className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        headerClassName="border-b border-[#E5E7EB]"
        bodyClassName="px-0 py-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B7280]">
                {[
                  "Zone",
                  "Severity",
                  "Impact",
                  "Disruption",
                  "Trigger Status",
                ].map((h) => (
                  <th key={h} className="px-5 py-3 border-b border-[#E5E7EB]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {globalDisruptions.map((d) => (
                <tr
                  key={d.name}
                  className="border-b border-[#E5E7EB] last:border-b-0 h-[44px]"
                >
                  {/* ── CHANGED: render zone pills instead of plain text ── */}
                  <td className="px-5 py-3">
                    {Array.isArray(d.zones) && d.zones.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {d.zones.map((z) => (
                          <span
                            key={z}
                            className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] text-[#374151]"
                          >
                            {z}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td
                    className={`px-5 py-3 tabular-nums ${severityBadge(d.severity)}`}
                  >
                    {d.severity}
                  </td>
                  <td className="px-5 py-3 text-[#374151] truncate">
                    {d.impact}
                  </td>
                  <td className="px-5 py-3 text-[#374151] truncate">
                    {d.name}
                  </td>
                  <td
                    className={`px-5 py-3 ${d.status ? "text-[#EF4444] font-semibold" : "text-[#6B7280]"}`}
                  >
                    {yesNo(d.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Windy Satellite Weather Map ───────────────────────────────── */}
      <Panel
        title="LIVE SATELLITE WEATHER MAP"
        subtitle={
          realWeatherLoaded
            ? "Radar overlay — real-time data"
            : "Radar overlay — interactive"
        }
        className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        headerClassName="border-b border-[#E5E7EB]"
        bodyClassName="p-0 overflow-hidden"
      >
        <div className="w-full" style={{ height: "420px" }}>
          <iframe
            src="https://embed.windy.com/embed2.html?lat=16.5062&lon=80.6480&zoom=6&level=surface&overlay=radar&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="yes"
            title="Windy Satellite Weather Map"
            style={{ display: "block", border: "none" }}
            allow="fullscreen"
          />
        </div>
        {realWeatherLoaded && (
          <div className="px-4 py-2 border-t border-[#E5E7EB] flex items-center gap-4 text-[11px] text-[#6B7280]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
              Live radar data
            </span>
            <span>Source: OpenWeatherMap + WAQI</span>
          </div>
        )}
      </Panel>

      {/* ── Manager Flags (Admin Review) ─────────────────────────────── */}
      <Panel
        title="MANAGER DISRUPTION FLAGS"
        subtitle="Curfews · Protests · Road Blockages · Strikes — pending admin review"
        className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        headerClassName="border-b border-[#E5E7EB]"
        bodyClassName="px-0 py-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B7280]">
                {[
                  "Zone",
                  "Type",
                  "Description",
                  "Status",
                  "Payout",
                  "Admin Action",
                ].map((h) => (
                  <th key={h} className="px-5 py-3 border-b border-[#E5E7EB]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managerFlags.length === 0 ? (
                <tr>
                  <td
                    className="px-5 py-4 text-[#6B7280] text-[12px]"
                    colSpan={6}
                  >
                    No manager flags pending review
                  </td>
                </tr>
              ) : (
                managerFlags.map((flag) => {
                  const isPending = flag.flag_status === "pending";
                  const isVerified = flag.flag_status === "verified";
                  const isRejected = flag.flag_status === "rejected";
                  const isBusy = flagActionInProgress === flag.flag_id;

                  return (
                    <tr
                      key={flag.flag_id}
                      className="border-b border-[#E5E7EB] last:border-b-0 h-[52px]"
                    >
                      <td className="px-5 py-3 text-[#111827] font-medium truncate">
                        {flag.zone_id}
                      </td>
                      <td className="px-5 py-3 text-[#374151] capitalize truncate">
                        {flag.disruption_type}
                      </td>
                      <td className="px-5 py-3 text-[#6B7280] truncate max-w-[200px]">
                        {flag.description || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
                            (isVerified
                              ? "bg-[#DCFCE7] text-[#16A34A]"
                              : isRejected
                                ? "bg-[#FEE2E2] text-[#DC2626]"
                                : "bg-[#FEF9C3] text-[#CA8A04]")
                          }
                        >
                          {flag.flag_status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            flag.payout_enabled
                              ? "text-[#16A34A] font-semibold"
                              : "text-[#6B7280]"
                          }
                        >
                          {flag.payout_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-5 py-2">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleManagerFlagAction(flag.flag_id, "verify")
                              }
                              className="rounded-full border border-[#16A34A] bg-white px-3 py-1 text-[10px] uppercase tracking-wider text-[#16A34A] hover:bg-[#F0FDF4] disabled:opacity-50 transition-colors"
                            >
                              {isBusy ? "..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleManagerFlagAction(flag.flag_id, "reject")
                              }
                              className="rounded-full border border-[#EF4444] bg-white px-3 py-1 text-[10px] uppercase tracking-wider text-[#EF4444] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors"
                            >
                              {isBusy ? "..." : "Reject"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#9CA3AF] italic">
                            {isVerified
                              ? "Approved by Admin"
                              : "Rejected by Admin"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="ACTIVE DISRUPTIONS"
          subtitle="currently ongoing"
          className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          headerClassName="border-b border-[#E5E7EB]"
          bodyClassName="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B7280]">
                  {["Zone", "Severity", "Impact", "Type", "Trigger Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 border-b border-[#E5E7EB]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {derived.activeZone.length === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-[#6B7280]" colSpan={5}>
                      No active disruptions
                    </td>
                  </tr>
                ) : (
                  derived.activeZone.map((z) => (
                    <tr
                      key={z.zone}
                      className="border-b border-[#E5E7EB] last:border-b-0 h-[44px]"
                    >
                      <td className="px-5 py-3 text-[#111827] truncate">
                        {z.zone}
                      </td>
                      <td
                        className={`px-5 py-3 tabular-nums ${severityBadge(z.severity)}`}
                      >
                        {z.severity}
                      </td>
                      <td className="px-5 py-3 text-[#374151] truncate">
                        {z.impact}
                      </td>
                      <td className="px-5 py-3 text-[#374151] truncate">
                        {z.disruption_type}
                      </td>
                      <td
                        className={`px-5 py-3 ${z.manager_flag ? "text-[#EF4444] font-semibold" : "text-[#6B7280]"}`}
                      >
                        {yesNo(z.manager_flag)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="RESOLVED"
          subtitle="completed"
          className="bg-[#FFFFFF] text-[#111827] border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          headerClassName="border-b border-[#E5E7EB]"
          bodyClassName="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B7280]">
                  {["Zone", "Severity", "Impact", "Type", "Trigger Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 border-b border-[#E5E7EB]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {derived.resolvedZone.length === 0 &&
                derived.explicitlyResolved.length === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-[#6B7280]" colSpan={5}>
                      No resolved disruptions
                    </td>
                  </tr>
                ) : (
                  derived.resolvedZone.map((z) => (
                    <tr
                      key={z.zone}
                      className="border-b border-[#E5E7EB] last:border-b-0 h-[44px]"
                    >
                      <td className="px-5 py-3 text-[#111827] truncate">
                        {z.zone}
                      </td>
                      <td
                        className={`px-5 py-3 tabular-nums ${severityBadge(z.severity)}`}
                      >
                        {z.severity}
                      </td>
                      <td className="px-5 py-3 text-[#374151] truncate">
                        {z.impact}
                      </td>
                      <td className="px-5 py-3 text-[#374151] truncate">
                        {z.disruption_type}
                      </td>
                      <td
                        className={`px-5 py-3 ${z.manager_flag ? "text-[#EF4444] font-semibold" : "text-[#6B7280]"}`}
                      >
                        {yesNo(z.manager_flag)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </motion.div>
  );
}
