import React from 'react';

interface RiskGaugeProps {
  score: number; // 0–100
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score }) => {
  const R = 68;
  const cx = 90;
  const cy = 90;
  const arcLen = Math.PI * R; // ~213.6
  const filled = (score / 100) * arcLen;
  const offset = arcLen - filled;

  const needleAngle = -180 + (score / 100) * 180;

  const label =
    score < 30 ? 'LOW RISK' :
    score < 55 ? 'MODERATE RISK' :
    score < 75 ? 'MODERATE-HIGH RISK' :
    'HIGH RISK';

  const gradId = `riskGrad_${score}`;
  const glowId = `riskGlow_${score}`;

  // Dynamic color: green → yellow → red based on score
  const trackColor =
    score < 40 ? '#22c55e' :
    score < 70 ? '#eab308' :
    '#ef4444';


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0' }}>
      <svg viewBox="0 0 180 110" style={{ width: 200, height: 120, overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={`M${cx - R},${cy} A${R},${R} 0 0,1 ${cx + R},${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Colored fill arc */}
        <path
          d={`M${cx - R},${cy} A${R},${R} 0 0,1 ${cx + R},${cy}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={offset}
          filter={`url(#${glowId})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />

        {/* Needle */}
        <g transform={`rotate(${needleAngle}, ${cx}, ${cy})`}>
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy - R + 6}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy + 8}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
        <circle cx={cx} cy={cy} r="5" fill="#fff" />
        <circle cx={cx} cy={cy} r="3" fill={trackColor} style={{ transition: 'fill 0.8s ease' }} />

        {/* Labels */}
        <text x="16" y="107" fontSize="8" fill="#333" fontFamily="DM Mono, monospace" letterSpacing="0.05em">LOW</text>
        <text x="143" y="107" fontSize="8" fill="#333" fontFamily="DM Mono, monospace" letterSpacing="0.05em">HIGH</text>
      </svg>

      <div style={{
        fontFamily: 'Bebas Neue, Barlow Condensed, sans-serif',
        fontSize: 52,
        fontWeight: 400,
        letterSpacing: '0.02em',
        lineHeight: 1,
        color: trackColor,
        transition: 'color 0.8s ease',
        marginTop: -8,
      }}>
        {score}
      </div>
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: 9,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: '#111827',
        marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
};

export default RiskGauge;
