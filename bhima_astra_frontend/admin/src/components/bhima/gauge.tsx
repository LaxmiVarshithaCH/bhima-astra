import { useMemo } from 'react';

interface GaugeProps {
  value: number;
  max: number;
  title: string;
  detail: string;
  threshold: string;
}

const CIRC = 150.8; // 2 * PI * 24

export function Gauge({ value, max, title, detail, threshold }: GaugeProps) {
  const { pct, dash, strokeOpacity } = useMemo(() => {
    const pct = Math.min(value / max, 1);
    const dash = pct * CIRC;
    // High contrast: low = dim, high = full white
    const strokeOpacity = 0.2 + pct * 0.8;
    return { pct, dash, strokeOpacity };
  }, [value, max]);

  return (
    <div className="gauge-item">
      <div className="gauge-ring-wrap">
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          {/* Track */}
          <circle
            cx="30" cy="30" r="24"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
          />
          {/* Value arc */}
          <circle
            cx="30" cy="30" r="24"
            fill="none"
            stroke={`rgba(255,255,255,${strokeOpacity.toFixed(2)})`}
            strokeWidth="4"
            strokeDasharray={`${dash} ${CIRC}`}
            strokeLinecap="round"
            transform="rotate(-90 30 30)"
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke 0.6s ease' }}
          />
        </svg>
        <div className="gauge-val">{Math.round(pct * 100)}%</div>
      </div>
      <div className="gauge-info">
        <div className="gauge-title">{title}</div>
        <div className="gauge-detail">{detail}</div>
        <div className="gauge-threshold">{threshold}</div>
      </div>
    </div>
  );
}