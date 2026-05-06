import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { DisruptionEvent } from '../../lib/types';

/* ─────────────────────────────────────────────────────────────────
   Props
───────────────────────────────────────────────────────────────────*/
interface OracleCardProps {
  event:     DisruptionEvent | null;
  gauges:    { rainfall: number; aqi: number; traffic: number };
  isRunning: boolean; // from state.isRunning in use-simulation
}

/* ─────────────────────────────────────────────────────────────────
   Slide data model
───────────────────────────────────────────────────────────────────*/
interface SensorSlide {
  id:        string;
  eyebrow:   string;
  title:     string;
  value:     string;
  unit:      string;
  status:    string;
  alert:     boolean;
  pct:       number;
  threshold: string;
  detail:    string;
}

function buildSlides(
  event: DisruptionEvent | null,
  gauges: { rainfall: number; aqi: number; traffic: number },
): SensorSlide[] {
  const composite = event?.composite ?? 0;
  const rfAlert   = !!event && event.trigger.includes('rainfall');
  const aqAlert   = gauges.aqi > 300;
  const tfAlert   = gauges.traffic > 75;
  const csAlert   = composite > 0.7;

  return [
    {
      id:        'rainfall',
      eyebrow:   'Precipitation',
      title:     'Rainfall Index',
      value:     event ? event.rainfall.toFixed(1) : '0.0',
      unit:      'mm',
      status:    rfAlert ? 'Alert' : 'Normal',
      alert:     rfAlert,
      pct:       Math.min(gauges.rainfall / 100, 1),
      threshold: '> 45 mm',
      detail:    rfAlert ? 'Trigger threshold exceeded' : 'Within safe parameters',
    },
    {
      id:        'aqi',
      eyebrow:   'Atmosphere',
      title:     'Air Quality Index',
      value:     event ? String(event.aqi) : '0',
      unit:      'AQI',
      status:    aqAlert ? 'Hazardous' : gauges.aqi > 150 ? 'Unhealthy' : 'Moderate',
      alert:     aqAlert,
      pct:       Math.min(gauges.aqi / 500, 1),
      threshold: '> 300',
      detail:    aqAlert ? 'Emergency level detected' : 'Acceptable range',
    },
    {
      id:        'traffic',
      eyebrow:   'Mobility',
      title:     'Traffic Disruption',
      value:     event ? event.traffic.toFixed(1) : '0.0',
      unit:      'idx',
      status:    tfAlert ? 'Congested' : gauges.traffic > 50 ? 'Slow' : 'Moderate',
      alert:     tfAlert,
      pct:       Math.min(gauges.traffic / 100, 1),
      threshold: '> 75',
      detail:    tfAlert ? 'Severe congestion detected' : 'Traffic flowing',
    },
    {
      id:        'composite',
      eyebrow:   'Disruption Score',
      title:     'Composite Signal',
      value:     composite.toFixed(4),
      unit:      '',
      status:    csAlert ? 'Critical' : composite > 0.4 ? 'Elevated' : 'Nominal',
      alert:     csAlert,
      pct:       Math.min(composite, 1),
      threshold: '> 0.70',
      detail:    csAlert ? 'Multi-vector alert active' : 'Environmental baseline stable',
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────
   SensorSlide — one card in the belt
   Layout mirrors Nerova's case-study card:
     top area  = sensor gauge face  (replaces project photo)
     bottom strip = title + two stats + detail line
───────────────────────────────────────────────────────────────────*/
function SensorSlide({ slide }: { slide: SensorSlide }) {
  // Semicircle arc: path length ≈ π × 45 ≈ 141.37
  const ARC_LEN = 141.37;

  return (
    <div className={`oracle-slide${slide.alert ? ' oracle-slide--alert' : ''}`}>

      {/* ── Top: gauge face ── */}
      <div className="oracle-slide-face">
        <span className="oracle-slide-eyebrow">{slide.eyebrow}</span>

        <div className="oracle-slide-reading">
          <span className="oracle-slide-value">{slide.value}</span>
          {slide.unit && <span className="oracle-slide-unit">{slide.unit}</span>}
        </div>

        {/* Semicircular progress arc */}
        <div className="oracle-slide-arc-wrap" aria-hidden="true">
          <svg viewBox="0 0 100 56" className="oracle-slide-arc-svg">
            <path
              d="M 5 54 A 45 45 0 0 1 95 54"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 5 54 A 45 45 0 0 1 95 54"
              fill="none"
              stroke={slide.alert ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={ARC_LEN}
              strokeDashoffset={ARC_LEN * (1 - slide.pct)}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.4s' }}
            />
          </svg>
        </div>

        <span className="oracle-slide-thresh">trig {slide.threshold}</span>
      </div>

      {/* ── Bottom strip ── */}
      <div className="oracle-slide-footer">
        <div className="oracle-slide-title">{slide.title}</div>

        <div className="oracle-slide-meta-row">
          <div className="oracle-slide-stat">
            <div className="oracle-slide-stat-label">Reading</div>
            <div className={`oracle-slide-stat-val${slide.alert ? ' oracle-slide-stat-val--alert' : ''}`}>
              {slide.value}{slide.unit ? ` ${slide.unit}` : ''}
            </div>
          </div>
          <div className="oracle-slide-stat">
            <div className="oracle-slide-stat-label">Status</div>
            <div className={`oracle-slide-stat-badge${slide.alert ? ' oracle-slide-stat-badge--alert' : ''}`}>
              {slide.status}
            </div>
          </div>
        </div>

        <p className="oracle-slide-detail">{slide.detail}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   OracleCard — Nerova-style horizontal belt
───────────────────────────────────────────────────────────────────*/
const SPEED = 0.55; // px per rAF frame

export function OracleCard({ event, gauges, isRunning }: OracleCardProps) {
  const slides      = buildSlides(event, gauges);
  const belt        = [...slides, ...slides, ...slides]; // triple for seamless loop

  const trackRef    = useRef<HTMLDivElement>(null);
  const rafRef      = useRef<number | null>(null);
  const xRef        = useRef(0);
  const setWidthRef = useRef(0);
  const isRunRef    = useRef(isRunning);

  // Sync running state to ref without restarting the rAF loop
  useEffect(() => { isRunRef.current = isRunning; }, [isRunning]);

  // Measure one-set width after paint + on resize
  useEffect(() => {
    function measure() {
      if (trackRef.current && trackRef.current.scrollWidth > 0) {
        setWidthRef.current = trackRef.current.scrollWidth / 3;
      }
    }
    const id = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, []);

  // Single rAF loop — started once on mount, never restarted
  useEffect(() => {
    function tick() {
      if (setWidthRef.current === 0 && trackRef.current) {
        setWidthRef.current = trackRef.current.scrollWidth / 3;
      }
      if (isRunRef.current && setWidthRef.current > 0 && trackRef.current) {
        xRef.current -= SPEED;
        if (Math.abs(xRef.current) >= setWidthRef.current) xRef.current = 0;
        trackRef.current.style.transform = `translateX(${xRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, []); // intentionally mount-once

  const composite = event?.composite ?? 0;

  return (
    <motion.div
      className="nuvia-card oracle-belt-card"
      id="oracle-card"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="oracle-belt-header">
        <div>
          <div className="card-eyebrow">Environmental Oracle</div>
          <div className={`oracle-event-label${event ? ' active' : ''}`}>
            {event?.label || 'Awaiting signal…'}
          </div>
        </div>
        <span className={`oracle-live-badge${isRunning ? ' oracle-live-badge--on' : ''}`}>
          <span className="oracle-live-dot" />
          {isRunning ? 'LIVE' : 'IDLE'}
        </span>
      </div>

      {/* ── Nerova belt ── */}
      <div className="oracle-belt-viewport">
        <span className="oracle-belt-fade oracle-belt-fade--l" aria-hidden="true" />
        <span className="oracle-belt-fade oracle-belt-fade--r" aria-hidden="true" />

        <div ref={trackRef} className="oracle-belt-track">
          {belt.map((slide, i) => (
            <SensorSlide key={`${slide.id}-${i}`} slide={slide} />
          ))}
        </div>
      </div>

      {/* Composite summary bar */}
      <div className="composite-block">
        <div className="composite-label-row">
          <span className="feat-k">Composite Disruption Score</span>
          <span className={`feat-v ${composite > 0.7 ? 'oracle-alert-text' : 'sage'}`}>
            {composite.toFixed(4)}
          </span>
        </div>
        <div className="composite-track">
          <motion.div
            className={`composite-fill${composite > 0.7 ? ' composite-fill--alert' : ''}`}
            animate={{ width: `${composite * 100}%` }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}