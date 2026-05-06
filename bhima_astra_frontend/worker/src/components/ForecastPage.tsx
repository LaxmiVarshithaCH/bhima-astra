import React, { useState, useEffect, useMemo } from "react";
import { useWorker } from "../context/WorkerContext";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "./ScrollReveal";
import { fetchAQIData, type AQIResult } from "../services/aqiService";

// --- Icons (SVGs) ---
const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const CloudSunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="M20 12h2" />
    <path d="m19.07 4.93-1.41 1.41" />
    <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
    <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
  </svg>
);

const WindIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
  </svg>
);

const DropletIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  </svg>
);

const CloudLightningIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
    <polyline points="13 11 9 17 15 17 11 23" />
  </svg>
);

const RainIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 13v8m-8-8v8m4-6v8m4-14a7 7 0 1 0-13.43 3h1.74a4.5 4.5 0 1 1 8.8 0h1.8A7 7 0 0 0 16 5Z" />
  </svg>
);

const CloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

// Navigation icons
const HomeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const GridIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);
const MapIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
const CalendarIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const UserIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// --- Shared Glassmorphism Style ---
const glassStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  border: "1px solid #e5e7eb",
  borderRadius: "24px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
  color: "#111827",
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f9fafb" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f9fafb" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#374151" }] },
  // Administrative boundaries → soft grey
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#6B7280" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#374151" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6B7280" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e9f5e9" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6B7280" }],
  },
  // Roads → soft grey geometry + grey strokes (not black)
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#e5e7eb" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#9CA3AF" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6B7280" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#D1D5DB" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#9CA3AF" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#374151" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#e5e7eb" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6B7280" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#dbeafe" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6366f1" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f9fafb" }],
  },
];

const WindyMapCard = () => {
  const { profile } = useWorker();

  const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
    vijayawada: { lat: 16.5062, lon: 80.648 },
    hyderabad: { lat: 17.385, lon: 78.4867 },
    mumbai: { lat: 19.076, lon: 72.8777 },
    delhi: { lat: 28.6139, lon: 77.209 },
    bangalore: { lat: 12.9716, lon: 77.5946 },
    bengaluru: { lat: 12.9716, lon: 77.5946 },
    chennai: { lat: 13.0827, lon: 80.2707 },
    kolkata: { lat: 22.5726, lon: 88.3639 },
    pune: { lat: 18.5204, lon: 73.8567 },
    ahmedabad: { lat: 23.0225, lon: 72.5714 },
    jaipur: { lat: 26.9124, lon: 75.7873 },
    lucknow: { lat: 26.8467, lon: 80.9462 },
    default: { lat: 20.5937, lon: 78.9629 }, // India center
  };

  const getCityCoords = (city: string | null | undefined) => {
    if (!city) return CITY_COORDS["default"];
    const key = city.toLowerCase().trim();
    return CITY_COORDS[key] ?? CITY_COORDS["default"];
  };

  const workerCityCoords = getCityCoords(profile?.city);
  const [coords, setCoords] = useState<{ lat: number; lon: number }>(
    workerCityCoords,
  );
  const [locationStatus, setLocationStatus] = useState<
    "loading" | "active" | "default"
  >("loading");

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(getCityCoords(profile?.city));
      setLocationStatus("default");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus("active");
      },
      () => {
        // GPS failed — fall back to worker's registered city
        setCoords(getCityCoords(profile?.city));
        setLocationStatus("default");
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  const windyUrl =
    `https://embed.windy.com/embed2.html` +
    `?lat=${coords.lat.toFixed(4)}&lon=${coords.lon.toFixed(4)}` +
    `&zoom=6&level=surface&overlay=thunder`;

  return (
    <>
      <style>{`
        .windy-embed-wrap {
          width: 100%;
          height: 420px;
          border-radius: 16px;
          position: relative;
        }
        .windy-embed-wrap iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          border-radius: 16px;
        }
        /* Pin sits at the exact centre of the map — Windy centres on coords */
        .windy-pin {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -100%);
          z-index: 10;
          pointer-events: none;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.45));
        }
        /* Pulsing ring behind the pin base */
        .windy-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.35);
          transform: translate(-50%, -50%);
          z-index: 9;
          pointer-events: none;
          animation: windy-pulse-anim 2s ease-out infinite;
        }
        @keyframes windy-pulse-anim {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
        }
        @media (max-width: 1024px) { .windy-embed-wrap { height: 300px; } }
        @media (min-width: 1440px) { .windy-embed-wrap { height: 460px; } }
      `}</style>
      <motion.div
        className="premium-hover"
        style={{
          ...glassStyle,
          width: "100%",
          padding: "20px 20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            Live Thunderstorm Map — Your Location
          </h3>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color:
                locationStatus === "active"
                  ? "#16a34a"
                  : locationStatus === "loading"
                    ? "#d97706"
                    : "#6b7280",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {locationStatus === "active" && "📍 GPS Active"}
            {locationStatus === "loading" && "⏳ Locating…"}
            {locationStatus === "default" && `📍 ${profile?.city ?? "India"}`}
          </span>
        </div>

        {/* Map container — marker overlaid at centre = worker's coords */}
        <div className="windy-embed-wrap">
          {/* Pulse ring */}
          <div className="windy-pulse" />

          {/* SVG location pin */}
          <div className="windy-pin">
            <svg
              width="32"
              height="42"
              viewBox="0 0 32 42"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Pin body */}
              <path
                d="M16 0C7.163 0 0 7.163 0 16c0 10.667 16 26 16 26S32 26.667 32 16C32 7.163 24.837 0 16 0z"
                fill="#ef4444"
              />
              {/* White border ring */}
              <path
                d="M16 1C7.716 1 1 7.716 1 16c0 10.2 15 24.8 15 24.8S31 26.2 31 16C31 7.716 24.284 1 16 1z"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
              />
              {/* Inner white dot */}
              <circle cx="16" cy="16" r="7" fill="white" />
              {/* Centre dot */}
              <circle cx="16" cy="16" r="3.5" fill="#ef4444" />
            </svg>
          </div>

          {/* Windy iframe — reloads when coords change */}
          <iframe
            key={`${coords.lat.toFixed(4)}-${coords.lon.toFixed(4)}`}
            src={windyUrl}
            title="Live Thunderstorm Weather — Worker Location"
            allow="fullscreen"
            scrolling="yes"
          />
        </div>
      </motion.div>
    </>
  );
};

const getConditionImage = (conditionStr: string): string => {
  const c = conditionStr.toLowerCase();
  if (c.includes("partly cloudy")) return "/images/Sunny2.png";
  if (c.includes("clear") || c.includes("sunny")) return "/images/Sunny.png";
  if (c.includes("cloud")) return "/images/cloudy.png";
  if (c.includes("rain") || c.includes("drizzle")) return "/images/rainy.png";
  if (c.includes("thunder") || c.includes("storm"))
    return "/images/thunder strom.png";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze"))
    return "/images/Foggyclimate.png";
  if (c.includes("wind")) return "/images/windy.png";
  return "/images/Sunny.png";
};

const getVideoForCondition = (conditionStr: string): string => {
  const c = conditionStr.toLowerCase();
  if (c.includes("clear") || c.includes("sun"))
    return "/images/ClearSkyVid.mp4";
  if (c.includes("cloud")) return "/images/CloudyVid.mp4";
  if (c.includes("rain") || c.includes("drizzle"))
    return "/images/RainyVid.mp4";
  if (c.includes("thunder") || c.includes("storm"))
    return "/images/StormyVid.mp4";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze"))
    return "/images/FoggyVid.mp4";
  if (c.includes("wind")) return "/images/WindyVid.mp4";
  return "/images/SunnyVid.mp4";
};

export default function ForecastPage() {
  const { profile } = useWorker();

  // Derive city name for OWM API — fall back to Vijayawada
  const cityQuery = useMemo(() => {
    const c = profile?.city?.trim();
    if (!c) return "Vijayawada,IN";
    // OWM needs city,country — append ,IN for India
    return `${c},IN`;
  }, [profile?.city]);

  // Derive lat/lon for AQI from city
  const CITY_COORDS_FORECAST: Record<string, { lat: number; lon: number }> = {
    vijayawada: { lat: 16.5062, lon: 80.648 },
    hyderabad: { lat: 17.385, lon: 78.4867 },
    mumbai: { lat: 19.076, lon: 72.8777 },
    delhi: { lat: 28.6139, lon: 77.209 },
    bangalore: { lat: 12.9716, lon: 77.5946 },
    bengaluru: { lat: 12.9716, lon: 77.5946 },
    chennai: { lat: 13.0827, lon: 80.2707 },
    kolkata: { lat: 22.5726, lon: 88.3639 },
    pune: { lat: 18.5204, lon: 73.8567 },
    ahmedabad: { lat: 23.0225, lon: 72.5714 },
    jaipur: { lat: 26.9124, lon: 75.7873 },
    lucknow: { lat: 26.8467, lon: 80.9462 },
  };
  const aqiCoords = useMemo(() => {
    const key = (profile?.city ?? "vijayawada").toLowerCase().trim();
    return CITY_COORDS_FORECAST[key] ?? { lat: 16.5062, lon: 80.648 };
  }, [profile?.city]);

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [greeting, setGreeting] = useState("");
  const [activeTab, setActiveTab] = useState("4 Days");
  const [apiCondition, setApiCondition] = useState<string>("Partly Cloudy");
  const [apiTempStr, setApiTempStr] = useState<{
    t: string;
    h: string;
    l: string;
  }>({ t: "32°", h: "32°", l: "20°" });
  const [apiWind, setApiWind] = useState("12 km/h");
  const [apiHumidity, setApiHumidity] = useState("45%");
  const [aqiData, setAqiData] = useState<AQIResult>({
    raw: null,
    display: "--",
    label: "Loading…",
    color: "#111827",
    source: "none",
  });

  const [hourlyData, setHourlyData] = useState<any[]>([
    { x: 0, y: 75, t: "20°", h: "Now" },
    { x: 100, y: 35, t: "24°", h: "12 PM" },
    { x: 200, y: 45, t: "23°", h: "2 PM" },
    { x: 300, y: 75, t: "20°", h: "4 PM" },
    { x: 400, y: 30, t: "25°", h: "6 PM" },
    { x: 500, y: 15, t: "27°", h: "8 PM" },
  ]);

  const [dailyData, setDailyData] = useState<any[]>([]);

  useEffect(() => {
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${cityQuery}&appid=${import.meta.env.VITE_WEATHER_API_KEY}&units=metric`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.weather?.[0]?.description)
          setApiCondition(data.weather[0].description);
        if (data?.main) {
          setApiTempStr({
            t: Math.round(data.main.temp) + "°",
            h: Math.round(data.main.temp_max) + "°",
            l: Math.round(data.main.temp_min) + "°",
          });
          setApiHumidity(data.main.humidity + "%");
        }
        if (data?.wind) {
          setApiWind(Math.round(data.wind.speed * 3.6) + " km/h");
        }
      })
      .catch(() => {});

    // Fetch AQI using shared service (OWM primary → WAQI fallback)
    fetchAQIData(aqiCoords.lat, aqiCoords.lon).then((result) => {
      console.log("[ForecastPage] AQI result:", result);
      setAqiData(result);
    });

    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${cityQuery}&appid=${import.meta.env.VITE_WEATHER_API_KEY}&units=metric`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.list) {
          const hd = data.list.slice(0, 6).map((item: any) => {
            const d = new Date(item.dt * 1000);
            let h = d.getHours();
            const ampm = h >= 12 ? "PM" : "AM";
            h = h % 12;
            h = h ? h : 12;
            return {
              t: Math.round(item.main.temp) + "°",
              h: h + " " + ampm,
              tempNum: item.main.temp,
            };
          });
          const temps = hd.map((i: any) => i.tempNum);
          const minT = Math.min(...temps) - 2;
          const maxT = Math.max(...temps) + 2;
          const hdMapped = hd.map((item: any, idx: number) => ({
            ...item,
            x: idx * 100,
            y:
              maxT === minT
                ? 50
                : 100 - ((item.tempNum - minT) / (maxT - minT)) * 80,
          }));
          if (hdMapped.length > 0) setHourlyData(hdMapped);

          const daysMap = new Map();
          data.list.forEach((item: any) => {
            const d = new Date(item.dt * 1000);
            const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
            if (!daysMap.has(dayStr)) {
              daysMap.set(dayStr, {
                day: dayStr,
                condition: item.weather[0].main,
                iconCode: item.weather[0].icon,
                min: item.main.temp_min,
                max: item.main.temp_max,
              });
            } else {
              const existing = daysMap.get(dayStr);
              existing.min = Math.min(existing.min, item.main.temp_min);
              existing.max = Math.max(existing.max, item.main.temp_max);
            }
          });

          const getIconForCondition = (condition: string) => {
            const c = condition.toLowerCase();
            if (c.includes("clear") || c.includes("sun"))
              return <SunIcon width={24} />;
            if (c.includes("partly cloudy")) return <CloudSunIcon width={24} />;
            if (c.includes("cloud")) return <CloudIcon width={24} />;
            if (c.includes("rain") || c.includes("drizzle"))
              return <RainIcon width={24} />;
            if (c.includes("thunder") || c.includes("storm"))
              return <CloudLightningIcon width={24} />;
            return <CloudSunIcon width={24} />;
          };

          const dData = Array.from(daysMap.values())
            .slice(0, 5)
            .map((item: any) => ({
              day: item.day,
              condition: item.condition,
              icon: getIconForCondition(item.condition),
              temp: `${Math.round(item.max)}° / ${Math.round(item.min)}°`,
            }));
          setDailyData(dData);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const getGreeting = (hour: number) => {
      if (hour >= 5 && hour < 12) return "Good Morning";
      if (hour >= 12 && hour < 17) return "Good Afternoon";
      if (hour >= 17 && hour < 21) return "Good Evening";
      return "Good Night";
    };
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
      setDate(
        now.toLocaleDateString([], {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      );
      setGreeting(getGreeting(now.getHours()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mock forecast list
  const baseForecast = [
    {
      day: "Friday",
      icon: <CloudSunIcon width={24} />,
      condition: "Partly Cloudy",
      temp: "26° / 18°",
    },
    {
      day: "Saturday",
      icon: <SunIcon width={24} />,
      condition: "Sunny",
      temp: "29° / 20°",
    },
    {
      day: "Sunday",
      icon: <CloudLightningIcon width={24} />,
      condition: "Storms",
      temp: "24° / 19°",
    },
    {
      day: "Monday",
      icon: <RainIcon width={24} />,
      condition: "Rain",
      temp: "22° / 17°",
    },
  ];

  const getForecastData = () => {
    if (dailyData.length > 0) {
      if (activeTab === "4 Days") return dailyData.slice(0, 4);
      return dailyData.slice(0, 5);
    }
    // Fallback Mock Data
    if (activeTab === "4 Days") return baseForecast.slice(0, 4);
    return [
      ...baseForecast,
      {
        day: "Tuesday",
        icon: <CloudIcon width={24} />,
        condition: "Overcast",
        temp: "23° / 17°",
      },
    ].slice(0, 5);
  };

  const getCurvePath = (data: any[]) => {
    if (data.length === 0) return "";
    let d = `M${data[0].x},${data[0].y} `;
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const ctrl1X = prev.x + (curr.x - prev.x) / 2;
      const ctrl2X = prev.x + (curr.x - prev.x) / 2;
      d += `C${ctrl1X},${prev.y} ${ctrl2X},${curr.y} ${curr.x},${curr.y} `;
    }
    return d;
  };

  return (
    <div
      className="forecast-page-wrapper"
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        paddingTop: "32px",
        paddingBottom: "32px",
        paddingLeft: "32px",
        paddingRight: "32px",
        background: "#f5f7fb", // Light admin background
        color: "#111827",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .forecast-page-wrapper {
          overflow-x: hidden;
        }
        .forecast-main-container {
          display: grid;
          grid-template-columns: 7fr 3fr;
          gap: 32px;
          width: 100%;
          max-width: 100%;
        }
        .weather-hero-time {
          font-size: 4.5rem;
          font-weight: 700;
          margin: 0;
          line-height: 1;
          letter-spacing: -1px;
        }
        .forecast-left-col, .forecast-right-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
        }
        .hourly-chart-container {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .hourly-chart-inner {
          position: relative;
          height: 210px;
          width: 100%;
        }
        .weather-hero-icon {
          filter: none;
          color: #111827;
        }
        @media (max-width: 1024px) {
          .forecast-main-container {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .forecast-page-wrapper {
            padding: 16px !important;
            padding-bottom: 80px !important;
          }
          .forecast-main-container {
            gap: 16px !important;
            padding: 16px !important;
            border-radius: 24px !important;
          }
          .premium-hover {
            padding: 16px !important;
          }
          .weather-hero-card {
            height: auto !important;
            min-height: 280px;
            padding: 0 !important;
          }
          .weather-hero-text {
            padding: 16px !important;
          }
          .weather-hero-time {
            font-size: clamp(28px, 6vw, 48px) !important;
          }
          .weather-hero-icon svg {
            width: 80px !important;
            height: 80px !important;
          }
          .hourly-chart-inner {
            min-width: 600px;
          }
          .current-weather-panel {
            padding: 32px 16px !important;
          }
        }
      `}</style>
      {/* MAIN CONTAINER (Rounded outer container with soft shadow) */}
      <motion.div
        className="forecast-main-container"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "#f5f7fb",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderRadius: "40px",
          padding: "32px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          color: "#111827",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT COLUMN: 70% */}
        <ScrollReveal delay={0.05} className="forecast-left-col">
          <style>{`
            .weather-hero-card::before {
              content: '';
              position: absolute;
              inset: 0;
              background: linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
              border-radius: inherit;
              z-index: 1;
              pointer-events: none;
            }
            .weather-hero-text {
              position: relative;
              z-index: 2;
              color: #111827;
              text-shadow: none;
            }
            .weather-glass-panel {
              background: rgba(255,255,255,0.75);
              backdrop-filter: none;
              border: 1px solid #e5e7eb;
            }
          `}</style>
          {/* SECTION 1: Weather Hero Card */}
          <motion.div
            className="premium-hover weather-hero-card"
            style={{
              ...glassStyle,
              height: "400px",
              padding: 0,
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={apiCondition}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "inherit",
                  overflow: "hidden",
                  zIndex: 0,
                }}
              >
                <video
                  key={apiCondition}
                  ref={(el) => {
                    if (el) {
                      el.play().catch((e) =>
                        console.log("Autoplay prevented:", e),
                      );
                    }
                  }}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  poster={getConditionImage(apiCondition)}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    zIndex: 0,
                    filter: "contrast(1.1) brightness(1.05)",
                  }}
                >
                  <source
                    src={getVideoForCondition(apiCondition)}
                    type="video/mp4"
                  />
                </video>
              </motion.div>
            </AnimatePresence>

            <div
              className="weather-hero-text"
              style={{
                padding: "36px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 500,
                    margin: "0 0 12px 0",
                    opacity: 0.95,
                  }}
                >
                  {greeting || "Good Morning"}, Worker
                </h2>
                <h1 className="weather-hero-time">{time || "08:00 AM"}</h1>
                <p
                  style={{
                    fontSize: "1.1rem",
                    margin: "12px 0 0 0",
                    opacity: 0.9,
                  }}
                >
                  {date || "Monday, 10 April 2026"}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "2.2rem",
                      fontWeight: 600,
                      margin: "0 0 16px 0",
                      textTransform: "capitalize",
                    }}
                  >
                    {apiCondition}
                  </h3>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <span
                      className="weather-glass-panel"
                      style={{
                        padding: "6px 16px",
                        borderRadius: "20px",
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    >
                      H: {apiTempStr.h}
                    </span>
                    <span
                      className="weather-glass-panel"
                      style={{
                        padding: "6px 16px",
                        borderRadius: "20px",
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    >
                      L: {apiTempStr.l}
                    </span>
                  </div>
                </div>

                <div className="weather-hero-icon">
                  <CloudSunIcon width={130} height={130} strokeWidth={1.2} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECTION 2: Hourly Forecast */}
          <motion.div
            className="premium-hover"
            style={{ ...glassStyle, padding: "28px" }}
          >
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: "1.1rem",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Hourly Forecast
            </h3>
            {/* Chart uses a 600x160 viewBox with 50px left margin for Y-axis and 20px top/bottom padding */}
            <div className="hourly-chart-container">
              <div className="hourly-chart-inner">
                <svg
                  viewBox="0 0 600 200"
                  style={{ width: "100%", height: "100%", overflow: "visible" }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="lineGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(96,165,250,0.45)" />
                      <stop offset="100%" stopColor="rgba(96,165,250,0)" />
                    </linearGradient>
                    <filter
                      id="glowBlue"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* ── Horizontal grid lines (Y-axis levels: 0%, 25%, 50%, 75%, 100% of chart area) */}
                  {/* Chart area: y from 15 to 155 (140px tall), x from 50 to 590 */}
                  {[0, 1, 2, 3, 4].map((i) => {
                    const y = 15 + i * 35;
                    return (
                      <line
                        key={i}
                        x1="50"
                        y1={y}
                        x2="590"
                        y2={y}
                        stroke="rgba(17,24,39,0.07)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* ── Vertical grid lines (one per data point) */}
                  {hourlyData.map((p, i) => {
                    const x =
                      50 +
                      i * ((590 - 50) / Math.max(hourlyData.length - 1, 1));
                    return (
                      <line
                        key={i}
                        x1={x}
                        y1="15"
                        x2={x}
                        y2="155"
                        stroke="rgba(17,24,39,0.05)"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* ── Y-axis temperature labels */}
                  {(() => {
                    const temps = hourlyData.map((p: any) => parseFloat(p.t));
                    const maxT = temps.length ? Math.max(...temps) + 3 : 40;
                    const minT = temps.length ? Math.min(...temps) - 3 : 18;
                    return [0, 1, 2, 3, 4].map((i) => {
                      const y = 15 + i * 35;
                      const val = Math.round(maxT - (i * (maxT - minT)) / 4);
                      return (
                        <text
                          key={i}
                          x="44"
                          y={y + 4}
                          fill="rgba(17,24,39,0.35)"
                          fontSize="10"
                          textAnchor="end"
                          fontFamily="system-ui"
                        >
                          {val}°
                        </text>
                      );
                    });
                  })()}

                  {/* ── Map data x-coords into chart area [50..590], y into [15..155] */}
                  {(() => {
                    const n = hourlyData.length;
                    if (n === 0) return null;
                    const temps = hourlyData.map((p: any) => parseFloat(p.t));
                    const maxT = Math.max(...temps) + 3;
                    const minT = Math.min(...temps) - 3;
                    const mapped = hourlyData.map((p: any, i: number) => ({
                      ...p,
                      cx: 50 + i * ((590 - 50) / Math.max(n - 1, 1)),
                      cy:
                        maxT === minT
                          ? 85
                          : 15 +
                            (1 - (parseFloat(p.t) - minT) / (maxT - minT)) *
                              140,
                    }));

                    // Build smooth curve path
                    let curvePath = `M${mapped[0].cx},${mapped[0].cy}`;
                    for (let i = 1; i < mapped.length; i++) {
                      const prev = mapped[i - 1];
                      const curr = mapped[i];
                      const cpx = (prev.cx + curr.cx) / 2;
                      curvePath += ` C${cpx},${prev.cy} ${cpx},${curr.cy} ${curr.cx},${curr.cy}`;
                    }
                    const last = mapped[mapped.length - 1];
                    const fillPath = `${curvePath} L${last.cx},155 L${mapped[0].cx},155 Z`;

                    return (
                      <>
                        {/* Area fill */}
                        <path
                          d={fillPath}
                          fill="url(#lineGrad2)"
                          style={{ transition: "d 0.5s ease" }}
                        />
                        {/* Line with glow */}
                        <path
                          d={curvePath}
                          fill="none"
                          stroke="#60A5FA"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#glowBlue)"
                          vectorEffect="non-scaling-stroke"
                          style={{ transition: "d 0.5s ease" }}
                        />
                        {/* Points + labels */}
                        {mapped.map((p: any, i: number) => (
                          <g key={i}>
                            {/* Outer glow ring */}
                            <circle
                              cx={p.cx}
                              cy={p.cy}
                              r="8"
                              fill="rgba(96,165,250,0.15)"
                            />
                            {/* Point */}
                            <circle
                              cx={p.cx}
                              cy={p.cy}
                              r="4.5"
                              fill="#1e293b"
                              stroke="#60A5FA"
                              strokeWidth="2"
                              style={{
                                transition: "cx 0.5s ease, cy 0.5s ease",
                              }}
                            />
                            {/* Temp label above */}
                            <text
                              x={p.cx}
                              y={p.cy - 14}
                              fill="#111827"
                              fontSize="11"
                              textAnchor="middle"
                              fontWeight="600"
                              fontFamily="system-ui"
                              style={{ transition: "x 0.5s ease, y 0.5s ease" }}
                            >
                              {p.t}
                            </text>
                            {/* Time label below chart area */}
                            <text
                              x={p.cx}
                              y="175"
                              fill="rgba(107,114,128,0.7)"
                              fontSize="10"
                              textAnchor="middle"
                              fontFamily="system-ui"
                              style={{ transition: "x 0.5s ease" }}
                            >
                              {p.h}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}

                  {/* ── X-axis baseline */}
                  <line
                    x1="50"
                    y1="155"
                    x2="590"
                    y2="155"
                    stroke="rgba(17,24,39,0.12)"
                    strokeWidth="1"
                  />
                  {/* ── Y-axis baseline */}
                  <line
                    x1="50"
                    y1="15"
                    x2="50"
                    y2="155"
                    stroke="rgba(17,24,39,0.12)"
                    strokeWidth="1"
                  />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* SECTION 3: Cards */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            {/* TOP: Monthly Rainfall */}
            <motion.div
              className="premium-hover"
              style={{ ...glassStyle, width: "100%", padding: "24px" }}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: "#111827",
                }}
              >
                Monthly Rainfall
              </h3>
              <div
                style={{
                  display: "flex",
                  height: "170px",
                  width: "100%",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  padding: "0 8px",
                }}
              >
                {[
                  { l: "Jan", r: 40, s: 80 },
                  { l: "Feb", r: 50, s: 70 },
                  { l: "Mar", r: 30, s: 90 },
                  { l: "Apr", r: 90, s: 30 },
                  { l: "May", r: 100, s: 20 },
                  { l: "Jun", r: 60, s: 50 },
                ].map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "6px",
                        width: "24px",
                      }}
                    >
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${d.r}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        style={{
                          width: "8px",
                          background: "#3b82f6",
                          borderRadius: "4px",
                        }}
                      />
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${d.s}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        style={{
                          width: "8px",
                          background: "#fbbf24",
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#111827",
                        marginTop: "12px",
                      }}
                    >
                      {d.l}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  justifyContent: "center",
                  marginTop: "16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "2px",
                      background: "#3b82f6",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "#111827" }}>
                    Rain
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "2px",
                      background: "#fbbf24",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "#111827" }}>
                    Sun
                  </span>
                </div>
              </div>
            </motion.div>

            {/* RIGHT: Live Satellite Weather Map (Windy) */}
            <WindyMapCard />
          </div>
        </ScrollReveal>

        {/* RIGHT COLUMN: 30% */}
        <ScrollReveal delay={0.15} className="forecast-right-col">
          {/* SECTION 4: Current Weather Panel (Vertical) */}
          <motion.div
            className="premium-hover current-weather-panel"
            style={{
              ...glassStyle,
              padding: "48px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              position: "relative",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={apiCondition}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url("${getConditionImage(apiCondition)}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  zIndex: 0,
                }}
              />
            </AnimatePresence>
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  color: "#111827",
                  marginBottom: "20px",
                  filter: "none",
                }}
              >
                <SunIcon width={80} height={80} strokeWidth={1.5} />
              </div>
              <h2
                style={{
                  fontSize: "4rem",
                  fontWeight: 600,
                  margin: "8px 0",
                  lineHeight: 1,
                }}
              >
                {apiTempStr.t}
                {!apiTempStr.t.includes("°C") && "C"}
              </h2>
              <p
                style={{
                  fontSize: "1.2rem",
                  color: "#111827",
                  margin: "0 0 32px 0",
                  textTransform: "capitalize",
                }}
              >
                {apiCondition}
              </p>
            </div>

            <div
              style={{
                width: "100%",
                height: "1px",
                background: "#e5e7eb",
                marginBottom: "32px",
                position: "relative",
                zIndex: 1,
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                padding: "0 12px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "10px",
                    borderRadius: "50%",
                    color: "#60A5FA",
                  }}
                >
                  <WindIcon width={24} height={24} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "#111827",
                      marginBottom: "2px",
                    }}
                  >
                    Wind
                  </div>
                  <div style={{ fontWeight: 500, fontSize: "1.1rem" }}>
                    {apiWind}
                  </div>
                </div>
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "10px",
                    borderRadius: "50%",
                    color: "#3b82f6",
                  }}
                >
                  <DropletIcon width={24} height={24} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "#111827",
                      marginBottom: "2px",
                    }}
                  >
                    Humidity
                  </div>
                  <div style={{ fontWeight: 500, fontSize: "1.1rem" }}>
                    {apiHumidity}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECTION 5: Weather Forecast List */}
          <motion.div
            className="premium-hover"
            style={{
              ...glassStyle,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                padding: "6px",
                borderRadius: "20px",
                marginBottom: "20px",
                border: "1px solid #e5e7eb",
              }}
            >
              {["5 Days"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    border: "none",
                    background: activeTab === tab ? "#ffffff" : "transparent",
                    color: activeTab === tab ? "#111827" : "#111827",
                    padding: "10px 0",
                    borderRadius: "16px",
                    fontSize: "0.9rem",
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "none",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* List items */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowY: "auto",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {getForecastData().map((v, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        background: "#ffffff",
                        borderRadius: "16px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          width: "80px",
                          fontWeight: 500,
                          fontSize: "0.95rem",
                          color: "#111827",
                        }}
                      >
                        {v.day}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        <div style={{ color: "#60A5FA" }}>{v.icon}</div>
                        <span style={{ fontSize: "0.95rem", color: "#111827" }}>
                          {v.condition}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                        {v.temp}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* SECTION 6: AQI Live Tracker Card */}
          <motion.div
            className="premium-hover"
            style={{
              background: "#ffffff",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "16px",
              marginTop: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#111827",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                Air Quality Index
              </div>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: aqiData.raw != null ? aqiData.color : "#A1A1AA",
                  lineHeight: 1.2,
                }}
              >
                {aqiData.raw != null ? aqiData.raw : "AQI unavailable"}
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "#111827",
                  marginTop: "4px",
                }}
              >
                Vijayawada
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: aqiData.color,
                }}
              />
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "#ffffff",
                  color: aqiData.color,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  border: `1px solid ${aqiData.color}33`,
                }}
              >
                {aqiData.label}
              </div>
            </div>
          </motion.div>
        </ScrollReveal>
      </motion.div>
    </div>
  );
}
