import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props { score?: number; }

const CompositeScoreGauge: React.FC<Props> = ({ score = 0.72 }) => {
  const [animScore, setAnimScore] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for tracking visibility
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { threshold: 0.1 });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // RequestAnimationFrame for smooth score count and color transitions
  useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;
    const duration = 1200; // 1.2s smooth ease-out

    if (isVisible) {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic easeOut
        setAnimScore(score * easeOut);
        
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };
      animationFrameId = requestAnimationFrame(animate);
    } else {
      setAnimScore(0);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isVisible, score]);

  // Smooth Color Interpolation: Green -> Light Green -> Yellow -> Orange -> Red
  const interpolateColorRgbStr = (val: number) => {
    const stops = [
      { v: 0.0, rgb: [34, 197, 94] },  // Green
      { v: 0.2, rgb: [132, 204, 22] }, // Light Green
      { v: 0.4, rgb: [250, 204, 21] }, // Yellow
      { v: 0.7, rgb: [251, 146, 60] }, // Orange
      { v: 1.0, rgb: [239, 68, 68] }   // Red
    ];
    let lower = stops[0], upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (val >= stops[i].v && val <= stops[i + 1].v) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }
    const range = upper.v - lower.v;
    const ratio = range === 0 ? 0 : (val - lower.v) / range;
    const r = Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * ratio);
    const g = Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * ratio);
    const b = Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * ratio);
    return `${r}, ${g}, ${b}`;
  };

  const dynamicColorRgbStr = interpolateColorRgbStr(animScore);
  const currentDynamicColor = `rgb(${dynamicColorRgbStr})`;
  const glowShadowColor = `rgba(${dynamicColorRgbStr}, 0.12)`; // Subtle premium glow

  const CX = 100, CY = 100, R = 78;
  const FULL = 2 * Math.PI * R;
  const ARC  = (270 / 360) * FULL;
  const GAP  = FULL - ARC;
  
  // Animate stroke based on value
  const valueLen = animScore * ARC;

  // Use final score for static threshold labels (so labels don't jitter around during animation)
  const getLabel = (s: number) => s < 0.4 ? 'LOW RISK' : s <= 0.65 ? 'MEDIUM RISK' : 'HIGH RISK';
  const getBaseColor = (s: number) => s < 0.4 ? '#22c55e' : s <= 0.65 ? '#FBBF24' : '#FF5C5C';
  
  const finalStaticColor = getBaseColor(score);
  const isNearThreshold =
    (score >= 0.37 && score <= 0.43) ||
    (score >= 0.62 && score <= 0.68);

  const zones = [
    { start: 0,   end: 0.40, label: 'LOW',  color: '#22c55e' },
    { start: 0.4, end: 0.65, label: 'MED',  color: '#FBBF24' },
    { start: 0.65,end: 1.0,  label: 'HIGH', color: '#FF5C5C' },
  ];

  const mono = { fontFamily: 'DM Mono, monospace' } as React.CSSProperties;

  return (
    <motion.div
      ref={containerRef}
      style={{ 
        padding: '26px 28px', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        transition: 'box-shadow 0.1s ease',
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px 0px -30% 0px' }}
      transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ ...mono, fontsize: 12, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#111827' }}>
          Risk Score
        </span>
        <span style={{
          ...mono, fontsize: 10,
          border: `1px solid ${finalStaticColor}44`, color: finalStaticColor,
          padding: '3px 10px', borderRadius: 4, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {getLabel(score)}
        </span>
      </div>

      {/* SVG gauge */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', flex: 1 }}>
        <svg viewBox="0 0 200 178" style={{ width: '100%', maxWidth: 240 }}>
          {/* Base Track */}
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="#e5e7eb" strokeWidth={10}
            strokeDasharray={`${ARC} ${GAP}`} strokeLinecap="round"
            transform={`rotate(135, ${CX}, ${CY})`}
          />
          
          {/* Animated Fill */}
          <circle 
            cx={CX} cy={CY} r={R} fill="none"
            stroke={currentDynamicColor} 
            strokeWidth={10}
            strokeDasharray={`${valueLen} ${FULL}`}
            strokeLinecap="round"
            transform={`rotate(135, ${CX}, ${CY})`}
          />
          
          {/* Dynamic Glow Strip */}
          <circle 
            cx={CX} cy={CY} r={R} fill="none"
            stroke={`rgba(${dynamicColorRgbStr}, 0.3)`} 
            strokeWidth={18}
            strokeDasharray={`${valueLen * 0.3} ${FULL}`}
            strokeLinecap="round"
            transform={`rotate(135, ${CX}, ${CY})`}
          />
          
          {/* Animated Score number */}
          <text x={CX} y={CY - 8} textAnchor="middle"
            fontFamily="'Bebas Neue', 'Barlow Condensed', sans-serif"
            fontSize={52} fill="#111827" letterSpacing="0.02em">
            {Math.round(animScore * 100)}
          </text>
          
          <text x={CX} y={CY + 14} textAnchor="middle"
            fontFamily="DM Mono, monospace" fontSize={9} fill="#9ca3af" letterSpacing="0.1em">
            / 100
          </text>
          
          {/* Animated Dynamic Status Label Below Number */}
          <text x={CX} y={CY + 36} textAnchor="middle"
            fontFamily="DM Mono, monospace" fontSize={8} fill={currentDynamicColor} letterSpacing="0.16em">
            {getLabel(animScore)}
          </text>
        </svg>

        {isNearThreshold && (
          <div className="ripple-circle" style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 130, height: 130,
            borderColor: `rgba(${dynamicColorRgbStr}, 0.6)`,
            animationDuration: '1.8s',
          }} />
        )}
      </div>

      {/* Zone legend */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 12, paddingTop: 14,
        borderTop: '1px solid #f3f4f6',
      }}>
        {zones.map(z => (
          <div key={z.label} style={{ textAlign: 'center' }}>
            <div style={{ ...mono, fontsize: 10, color: z.color, letterSpacing: '0.1em' }}>{z.label}</div>
            <div style={{ ...mono, fontsize: 9, color: '#111827', marginTop: 2, letterSpacing: '0.04em' }}>
              {z.label === 'LOW' ? '< 40' : z.label === 'MED' ? '40–65' : '> 65'}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default CompositeScoreGauge;
