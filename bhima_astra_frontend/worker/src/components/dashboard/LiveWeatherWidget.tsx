import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAQIData, type AQIResult } from '../../services/aqiService';

/* ─── Types ─────────────────────────────────────── */
interface WeatherData {
  temperature: number;
  feelsLike: number;
  rainfall: number;
  windSpeed: number;
  condition: string;
  humidity: number;
  icon: string;
}

const getConditionImage = (conditionStr: string): string => {
  const c = conditionStr.toLowerCase();
  if (c.includes("partly cloudy")) return "/images/Sunny2.png";
  if (c.includes("clear") || c.includes("sunny")) return "/images/Sunny.png";
  if (c.includes("cloud")) return "/images/cloudy.png";
  if (c.includes("rain") || c.includes("drizzle")) return "/images/rainy.png";
  if (c.includes("thunder") || c.includes("storm")) return "/images/thunder strom.png";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return "/images/Foggyclimate.png";
  if (c.includes("wind")) return "/images/windy.png";
  return "/images/Sunny.png";
};

/* ─── Risk Calculator ─────────────────────────────── */
function calcRiskScore(rainfall: number, aqi: number, temp: number, wind: number): number {
  const r = Math.min(rainfall / 60, 1) * 0.35;
  const a = Math.min(aqi / 400,  1) * 0.35; 

  const t = Math.max(0, Math.min((temp - 30) / 20, 1)) * 0.15;
  const w = Math.min(wind / 50, 1) * 0.15;
  return Math.round((r + a + t + w) * 100);
}

function riskColor(score: number): string {
  if (score < 35) return '#22c55e';
  if (score < 60) return '#FBBF24';
  return '#FF5C5C';
}
function riskLabel(score: number): string {
  if (score < 35) return 'LOW RISK';
  if (score < 60) return 'MODERATE';
  return 'HIGH RISK';
}

/* ─── Skeleton ──────────────────────────────────── */
const Sk: React.FC<{ w?: number | string; h?: number }> = ({ w = '100%', h = 14 }) => (
  <div className="skeleton" style={{ width: w, height: h, borderRadius: 4, marginBottom: 4 }} />
);

/* ─── COMPONENT ─────────────────────────────────── */
const LiveWeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [aqiResult, setAqiResult] = useState<AQIResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  /* ── Refresh every 5 min ── */
  const fetchData = async () => {
    try {
      /* OpenWeatherMap */
      const owRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Vijayawada,IN&appid=${import.meta.env.VITE_WEATHER_API_KEY}&units=metric`
      );
      const ow = await owRes.json();



      setWeather({
        temperature: Math.round(ow.main?.temp ?? 36),
        feelsLike:   Math.round(ow.main?.feels_like ?? 39),
        rainfall:    ow.rain?.['1h'] ?? 0,
        windSpeed:   Math.round((ow.wind?.speed ?? 10) * 3.6), // m/s → km/h
        condition:   ow.weather?.[0]?.description ?? 'Clear',
        humidity:    ow.main?.humidity ?? 60,
        icon:        ow.weather?.[0]?.icon ?? '01d',
      });
    } catch {
      setError(true);
      setWeather({ temperature: 38, feelsLike: 42, rainfall: 22.4, windSpeed: 18, condition: 'Heavy Rain', humidity: 82, icon: '10d' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Use shared service: OWM primary → WAQI fallback
    fetchAQIData(16.5062, 80.6480).then(result => {
      console.log('[LiveWeatherWidget] AQI result:', result);
      setAqiResult(result);
    });
  }, []);

  const aqiRaw = aqiResult?.raw ?? null;
  const riskScore = weather && aqiRaw !== null
    ? calcRiskScore(weather.rainfall, aqiRaw, weather.temperature, weather.windSpeed)
    : 0;

  const rClr = riskColor(riskScore);
  const aClr = aqiResult?.color ?? '#111827';

  const mono = { fontFamily: 'DM Mono, monospace' } as React.CSSProperties;
  const editorial = {
    fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
    letterSpacing: '0.02em',
    lineHeight: 1,
  } as React.CSSProperties;

  return (
    <motion.div
      style={{
        padding: '26px 28px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px 0px -30% 0px' }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Background image removed — light admin theme */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6, background: '#60A5FA', borderRadius: '50%', flexShrink: 0, color: '#60A5FA' }} />
          <span style={{ ...mono, fontSize: 13.5, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#111827' }}>
            Live Weather · Yanamalakuduru
          </span>
        </div>
        {!loading && (
          <span style={{
            ...mono, fontSize: 13, fontWeight: 500,
            border: `1px solid ${rClr}44`, color: rClr,
            padding: '3px 10px', borderRadius: 4, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {riskLabel(riskScore)}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ flex: 1 }}>
          <Sk h={72} w="50%" />
          <Sk h={16} w="40%" />
          <div style={{ marginTop: 24 }}>
            {[1,2,3,4].map(i => <Sk key={i} h={40} />)}
          </div>
        </div>
      ) : (
        <>
          {/* Big temp display */}
          <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 6 }}>
                <span className="temperature" style={{ ...editorial, fontSize: 80, color: '#111827', marginBottom: 8, lineHeight: 1.1 }}>
                  {weather?.temperature}
                </span>
                <span style={{ ...mono, fontSize: 24, color: '#111827', marginTop: 12 }}>°C</span>
              </div>
              <div style={{ ...mono, fontSize: 13.5, fontWeight: 500, color: '#111827', letterSpacing: '0.06em', textTransform: 'capitalize', marginTop: -4 }}>
                {weather?.condition} · Feels {weather?.feelsLike}°C
              </div>
            </div>

            {/* Risk score disc */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                <circle
                  cx="36" cy="36" r="30"
                  fill="none"
                  stroke={rClr}
                  strokeWidth="6"
                  strokeDasharray={`${(riskScore / 100) * 188.4} 188.4`}
                  strokeLinecap="round"
                  transform="rotate(-90 36 36)"
                  style={{ transition: 'stroke-dasharray 1.2s ease' }}
                />
                <text x="36" y="32" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="20" fill="#111827">{riskScore}</text>
                <text x="36" y="44" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="13" fontWeight="500" fill="#6b7280" letterSpacing="2">RISK</text>
              </svg>
              {error && <div style={{ ...mono, fontSize: 13, fontWeight: 500, color: '#FBBF24', marginTop: 2 }}>DEMO DATA</div>}
            </div>
          </div>

          {/* Metric grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 0, borderTop: '1px solid #f3f4f6',
            borderRadius: 8, overflow: 'hidden',
            flex: 1,
          }}>
            {[
              { label: 'Rainfall', value: `${weather?.rainfall ?? 0}`, suffix: 'mm', color: '#2563eb' },
              { label: 'Wind Speed', value: `${weather?.windSpeed}`, suffix: 'km/h', color: '#111827' },
              { label: 'Humidity', value: `${weather?.humidity}`, suffix: '%', color: '#111827' }
            ].map((m, i) => (
              <div key={m.label} style={{
                padding: '14px 4px',
                paddingLeft: i % 2 === 1 ? 16 : 0,
                borderRight: i % 2 === 0 ? '1px solid #f3f4f6' : 'none',
                borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{ ...mono, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#111827', marginBottom: 5 }}>
                  {m.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="weather-number font-normal" style={{ ...mono, fontSize: 16, fontWeight: 400, color: m.color }}>{m.value}</span>
                  {m.suffix && <span className="weather-unit font-bold" style={{ ...mono, fontSize: 13, fontWeight: 'bold', color: '#111827' }}>{m.suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 16,
            padding: '14px 16px',
            background: '#f9fafb',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            transition: 'all 0.3s ease'
          }}>
            <span style={{ ...mono, fontSize: 13.5, fontWeight: 500, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Air Quality Index</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ ...editorial, fontSize: 24, color: aClr }}>
                {aqiResult?.raw != null ? aqiResult.raw : 'N/A'}
              </span>
              {aqiResult?.raw != null && (
                <span style={{ ...mono, fontSize: 11, color: aClr, letterSpacing: '0.08em' }}>
                  {aqiResult.label}
                </span>
              )}
              {aqiResult?.raw == null && (
                <span style={{ ...mono, fontSize: 11, color: '#A1A1AA', letterSpacing: '0.08em' }}>
                  AQI unavailable
                </span>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </motion.div>
  );
};

export default LiveWeatherWidget;
