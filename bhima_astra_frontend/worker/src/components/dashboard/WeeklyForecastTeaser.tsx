import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const mono = { fontFamily: 'DM Mono, monospace' } as React.CSSProperties;

/* ── Injected CSS for keyframe animations ───────────────────────── */
const STYLE_ID = 'wft-3d-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes wft-idle-rotate {
      0%   { transform: rotateY(0deg);  }
      25%  { transform: rotateY(8deg);  }
      75%  { transform: rotateY(-8deg); }
      100% { transform: rotateY(0deg);  }
    }
    @keyframes wft-spin {
      from { transform: rotateY(0deg);   }
      to   { transform: rotateY(360deg); }
    }
    .wft-bar-wrapper {
      position: relative;
      transform-style: preserve-3d;
      cursor: pointer;
      transition: transform 0.3s ease, filter 0.3s ease;
      animation: wft-idle-rotate 6s ease-in-out infinite;
    }
    .wft-bar-wrapper:hover {
      transform: translateY(-8px) !important;
      filter: brightness(1.15);
    }
    .wft-bar-wrapper.spinning {
      animation: wft-spin 0.6s ease-in-out forwards !important;
    }
    .wft-bar-wrapper.spinning-done {
      animation: wft-idle-rotate 6s ease-in-out infinite;
    }
  `;
  document.head.appendChild(s);
}

/* ── Risk colour palette ─────────────────────────────────────────── */
const getRiskMeta = (prob: number) => {
  if (prob <= 30) return {
    label:   'Low',
    front:   'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
    side:    '#15803d',
    top:     'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
    glow:    'rgba(34,197,94,0.5)',
    text:    '#4ade80',
    shadow:  'rgba(34,197,94,0.3)',
  };
  if (prob <= 60) return {
    label:   'Medium',
    front:   'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)',
    side:    '#a16207',
    top:     'linear-gradient(135deg, #fde047 0%, #eab308 100%)',
    glow:    'rgba(234,179,8,0.55)',
    text:    '#fde047',
    shadow:  'rgba(234,179,8,0.3)',
  };
  if (prob <= 80) return {
    label:   'High',
    front:   'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
    side:    '#c2410c',
    top:     'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
    glow:    'rgba(249,115,22,0.55)',
    text:    '#fb923c',
    shadow:  'rgba(249,115,22,0.3)',
  };
  return {
    label:   'Critical',
    front:   'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
    side:    '#991b1b',
    top:     'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
    glow:    'rgba(239,68,68,0.6)',
    text:    '#f87171',
    shadow:  'rgba(239,68,68,0.35)',
  };
};

/* ── Weather helpers ─────────────────────────────────────────────── */
const calcRisk = (item: any): number => {
  const pop    = (item.pop ?? 0) * 100;
  const wind   = (item.wind?.speed ?? 0) * 3.6;
  const clouds = item.clouds?.all ?? 0;
  const storm  = (item.weather?.[0]?.main ?? '').toLowerCase().includes('thunder');
  let risk = pop * 0.55 + Math.min(wind, 80) * 0.3 + clouds * 0.15;
  if (storm) risk = Math.min(risk + 18, 100);
  return Math.round(Math.min(Math.max(risk, 0), 100));
};

const condLabel = (main: string): string => {
  const m = main.toLowerCase();
  if (m.includes('thunder')) return 'Storm';
  if (m.includes('drizzle')) return 'Drizzle';
  if (m.includes('rain'))    return 'Rain';
  if (m.includes('snow'))    return 'Snow';
  if (m.includes('fog') || m.includes('mist')) return 'Fog';
  if (m.includes('cloud'))   return 'Cloudy';
  return 'Clear';
};

interface DayRisk { day: string; prob: number; condition: string; }

const FALLBACK: DayRisk[] = [
  { day: 'Mon', prob: 72, condition: 'Rain'   },
  { day: 'Tue', prob: 61, condition: 'Cloudy' },
  { day: 'Wed', prob: 45, condition: 'Cloudy' },
  { day: 'Thu', prob: 28, condition: 'Clear'  },
  { day: 'Fri', prob: 35, condition: 'Partly' },
  { day: 'Sat', prob: 55, condition: 'Storm'  },
  { day: 'Sun', prob: 80, condition: 'Rain'   },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Individual 3D Bar ───────────────────────────────────────────── */
interface Bar3DProps {
  d: DayRisk;
  index: number;
  isHighest: boolean;
}

const Bar3D: React.FC<Bar3DProps> = ({ d, index, isHighest }) => {
  const meta       = getRiskMeta(d.prob);
  const barH       = Math.max(d.prob, 8);          // % of 96px container
  const SIDE_W     = 8;                             // px — depth of side face
  const SIDE_ANGLE = 45;                            // deg for top trapezoid
  const wrapRef    = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    if (spinning) return;
    const el = wrapRef.current;
    if (!el) return;
    el.classList.remove('spinning-done');
    el.classList.add('spinning');
    setSpinning(true);
    setTimeout(() => {
      el.classList.remove('spinning');
      el.classList.add('spinning-done');
      setSpinning(false);
    }, 620);
  };

  const heightPx = `${barH}%`;

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
    >
      {/* Percentage label */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 + index * 0.08 }}
        className="forecast-value"
        style={{
          ...mono, fontSize: 13, color: meta.text,
          letterSpacing: '0.04em', fontWeight: 500,
          whiteSpace: 'nowrap'
        }}
      >
        {d.prob}%
      </motion.div>

      {/* Bar container — perspective space */}
      <div
        style={{
          width: '100%',
          height: 96,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0 2px',
          perspective: 600,
          perspectiveOrigin: '50% 100%',
        }}
      >
        {/* Grow‑from‑bottom wrapper (scaleY animation) */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          whileInView={{ scaleY: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.25 + index * 0.09, ease: 'easeOut' }}
          style={{
            width: '100%',
            height: heightPx,
            transformOrigin: 'bottom',
            position: 'relative',
          }}
        >
          {/* Rotating wrapper */}
          <div
            ref={wrapRef}
            className="wft-bar-wrapper"
            onClick={handleClick}
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              transformOrigin: 'center center',
            }}
          >
            {/* ── FRONT FACE ── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: meta.front,
                borderRadius: '4px 4px 2px 2px',
                boxShadow: `inset 0 3px 8px rgba(255,255,255,0.15),
                            inset 0 -4px 8px rgba(0,0,0,0.2),
                            0 8px 24px ${meta.shadow}`,
                overflow: 'hidden',
              }}
            >
              {/* Top highlight strip */}
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 6,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 100%)',
                  borderRadius: '4px 4px 0 0',
                  filter: 'blur(0.4px)',
                }}
              />
              {/* Center shine streak */}
              <div
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0,
                  left: '20%', width: '15%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)',
                  borderRadius: 4,
                }}
              />
            </div>

            {/* ── SIDE FACE (right) ── */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: -SIDE_W,
                width: SIDE_W,
                height: '100%',
                background: meta.side,
                borderRadius: '0 2px 2px 0',
                transform: `skewY(${SIDE_ANGLE}deg)`,
                transformOrigin: 'left top',
                boxShadow: `inset -2px 0 6px rgba(0,0,0,0.3)`,
                pointerEvents: 'none',
              }}
            />

            {/* ── TOP FACE ── */}
            <div
              style={{
                position: 'absolute',
                top: -SIDE_W,
                left: 0,
                right: 0,
                height: SIDE_W,
                background: meta.top,
                borderRadius: '3px 3px 0 0',
                transform: `skewX(-${SIDE_ANGLE}deg)`,
                transformOrigin: 'bottom left',
                boxShadow: `0 -2px 6px rgba(255,255,255,0.15)`,
                pointerEvents: 'none',
              }}
            />

            {/* Glow on hover overlay (CSS handles it via filter) */}
            {isHighest && (
              <div
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: 6,
                  border: `1px solid ${meta.text}`,
                  boxShadow: `0 0 12px ${meta.glow}`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Day label */}
      <div className="forecast-day" style={{ ...mono, fontSize: 13, fontWeight: 500, color: '#111827', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {d.day}
      </div>
      {/* Condition label */}
      <div className="forecast-condition" style={{ ...mono, fontSize: 12, color: '#111827', textAlign: 'center', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {d.condition}
      </div>
    </motion.div>
  );
};

/* ── Main Component ──────────────────────────────────────────────── */
const WeeklyForecastTeaser: React.FC = () => {
  const [riskData, setRiskData]   = useState<DayRisk[]>(FALLBACK);
  const [highestDay, setHighestDay] = useState<DayRisk | null>(null);

  useEffect(() => {
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=Vijayawada,IN&appid=${import.meta.env.VITE_WEATHER_API_KEY}&units=metric`
    )
      .then(r => r.json())
      .then(data => {
        if (!data?.list) return;
        const dayMap = new Map<string, any[]>();
        data.list.forEach((item: any) => {
          const d   = new Date(item.dt * 1000);
          const key = DAYS[d.getDay()];
          if (!dayMap.has(key)) dayMap.set(key, []);
          dayMap.get(key)!.push(item);
        });
        const result: DayRisk[] = Array.from(dayMap.entries())
          .slice(0, 7)
          .map(([day, items]) => {
            const maxItem = items.reduce((a, b) => calcRisk(a) >= calcRisk(b) ? a : b);
            return { day, prob: calcRisk(maxItem), condition: condLabel(maxItem.weather?.[0]?.main ?? 'Clear') };
          });
        if (result.length > 0) {
          setRiskData(result);
          setHighestDay(result.reduce((a, b) => a.prob >= b.prob ? a : b));
        }
      })
      .catch(() => {});
  }, []);

  const highest = highestDay ?? riskData.reduce((a, b) => a.prob >= b.prob ? a : b);

  return (
    <motion.div
      style={{
        padding: '28px 30px',
        display: 'flex',
        flexDirection: 'column',
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
      transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header — unchanged */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <span style={{ ...mono, fontsize: 12,fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#111827' }}>
          7-Day Risk Forecast
        </span>
        <motion.button
          whileHover={{ borderColor: '#d97706', color: '#d97706', background: '#fffbeb' }}
          style={{
            ...mono, fontsize: 11, color: '#111827',
            background: 'none', border: '1px solid #e5e7eb',
            padding: '5px 12px', cursor: 'pointer',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            transition: 'all 0.2s', borderRadius: 6,
          }}
        >
          Live →
        </motion.button>
      </div>

      {/* 7-day 3D bar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, flex: 1, alignItems: 'flex-end' }}>
        {riskData.map((d, i) => (
          <Bar3D
            key={d.day}
            d={d}
            index={i}
            isHighest={d.day === highest.day}
          />
        ))}
      </div>

      {/* Footer nudge — unchanged */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginTop: 18, paddingTop: 16,
        borderTop: '1px solid #f3f4f6',
      }}>
        <div className="pulse-dot" style={{ width: 5, height: 5, background: '#FBBF24', borderRadius: '50%', flexShrink: 0, color: '#FBBF24' }} />
        <span style={{ ...mono, fontsize: 11, color: '#111827', letterSpacing: '0.04em', lineHeight: 1.7 }}>
          {highest
            ? <>{highest.day} shows {highest.prob}% risk.{' '}
                <span style={{ color: '#FBBF24' }}>Upgrade to Premium</span>
                {' '}for hourly alerts &amp; extended coverage.
              </>
            : <>Upgrade to <span style={{ color: '#FBBF24' }}>Premium</span> for hourly alerts.</>
          }
        </span>
      </div>
    </motion.div>
  );
};

export default WeeklyForecastTeaser;
