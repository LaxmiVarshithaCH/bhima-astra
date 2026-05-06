import { useMemo, useEffect, useRef } from 'react';

interface SparklineProps {
  data: number[];
}

export function Sparkline({ data }: SparklineProps) {
  const pathRef = useRef<SVGPathElement>(null);

  const { pathD, fillD } = useMemo(() => {
    const W = 240;
    const H = 60;

    if (!data || data.length < 2) {
      return {
        pathD: 'M0 30 L240 30',
        fillD: 'M0 30 L240 30 L240 60 L0 60 Z'
      };
    }

    const max = Math.max(...data);
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * W,
      y: (H - 8) - (v / max) * (H - 16)
    }));

    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C${cpx} ${pts[i - 1].y} ${cpx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }

    const fillPath = d + ` L${pts[pts.length - 1].x} ${H} L0 ${H} Z`;
    return { pathD: d, fillD: fillPath };
  }, [data]);

  /* Animate the stroke drawing on data change */
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength?.() || 300;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    // Trigger draw
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      el.style.strokeDashoffset = '0';
    });
  }, [pathD]);

  return (
    <svg
      viewBox="0 0 240 60"
      preserveAspectRatio="none"
      style={{ width: '100%', height: '60px' }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-fill)" />
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.5"
      />
    </svg>
  );
}