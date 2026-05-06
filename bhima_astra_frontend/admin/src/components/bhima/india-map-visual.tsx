import { motion } from 'framer-motion';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';

const LIGHT = 'rgba(255, 253, 231,';
const LIGHT_SOFT = 'rgba(255, 248, 220,';

const INDIA_MAIN_D = `
  M 176 30
  L 182 26 L 190 23 L 200 22 L 210 23 L 218 26
  L 226 30 L 232 36 L 235 43 L 233 50
  L 238 52 L 246 50 L 255 48 L 264 50 L 270 56
  L 274 64 L 272 73 L 266 80 L 258 85
  L 264 88 L 272 93 L 278 101 L 280 111
  L 278 121 L 271 129 L 262 134 L 252 136
  L 255 144 L 260 153 L 264 163 L 265 173
  L 262 183 L 258 191 L 255 200
  L 260 208 L 265 218 L 268 228 L 268 238
  L 265 248 L 260 257 L 254 266 L 248 274
  L 244 282 L 242 291 L 243 300 L 246 309
  L 250 317 L 253 326 L 253 335 L 250 344
  L 245 352 L 238 360 L 231 367 L 224 374
  L 218 381 L 214 389 L 213 398 L 214 408
  L 218 417 L 222 426 L 224 435 L 222 443
  L 216 450 L 208 454 L 200 455 L 192 454
  L 185 450 L 180 443 L 178 434 L 178 424
  L 180 415 L 184 405 L 186 396 L 184 387
  L 179 379 L 173 371 L 167 363 L 161 355
  L 154 346 L 147 337 L 140 328 L 133 318
  L 125 308 L 118 298 L 112 288 L 107 278
  L 103 268 L 100 257 L 98 246 L 98 235
  L 100 224 L 104 214 L 107 204
  L 104 195 L 100 186 L 95 178
  L 90 169 L 87 160 L 86 150 L 88 140
  L 92 131 L 98 123 L 106 116 L 115 111
  L 124 108 L 130 102 L 133 93 L 134 83
  L 136 73 L 139 63 L 145 54 L 153 46
  L 162 40 L 170 35 Z`;

const INDIA_JK_D = `
  M 170 35 L 162 28 L 156 20 L 152 12
  L 158 6 L 167 4 L 178 6 L 188 10
  L 196 15 L 200 22 L 190 23 L 182 26 L 176 30 Z`;

const INDIA_NE_D = `
  M 272 93 L 280 88 L 290 84 L 302 82
  L 314 84 L 322 90 L 326 99 L 322 108
  L 314 114 L 304 116 L 294 114 L 284 110
  L 278 101 Z`;

const SRI_LANKA_D = 'M 204 462 Q 212 458 216 466 Q 218 476 213 483 Q 207 487 202 480 Q 200 471 204 462 Z';

const CITIES = [
  { name: 'Delhi', x: 178, y: 108, size: 5.2, brightness: 1 },
  { name: 'Mumbai', x: 118, y: 228, size: 4.8, brightness: 1 },
  { name: 'Kolkata', x: 262, y: 192, size: 4.2, brightness: 0.96 },
  { name: 'Chennai', x: 204, y: 338, size: 4, brightness: 0.93 },
  { name: 'Bengaluru', x: 188, y: 355, size: 3.8, brightness: 0.9 },
  { name: 'Hyderabad', x: 192, y: 292, size: 3.6, brightness: 0.88 },
  { name: 'Pune', x: 130, y: 248, size: 3.2, brightness: 0.84 },
  { name: 'Ahmedabad', x: 120, y: 178, size: 3.1, brightness: 0.82 },
  { name: 'Jaipur', x: 158, y: 130, size: 2.8, brightness: 0.78 },
  { name: 'Lucknow', x: 214, y: 138, size: 2.7, brightness: 0.76 },
  { name: 'Kanpur', x: 208, y: 148, size: 2.2, brightness: 0.7 },
  { name: 'Nagpur', x: 200, y: 238, size: 2.2, brightness: 0.67 },
  { name: 'Indore', x: 165, y: 198, size: 2, brightness: 0.64 },
  { name: 'Patna', x: 238, y: 158, size: 2, brightness: 0.62 },
  { name: 'Kochi', x: 178, y: 395, size: 1.9, brightness: 0.58 },
  { name: 'Guwahati', x: 298, y: 138, size: 1.8, brightness: 0.55 },
  { name: 'Colombo', x: 208, y: 435, size: 1.6, brightness: 0.52 }
];

const CONNECTIONS: [number, number][] = [
  [0, 8],
  [0, 9],
  [0, 2],
  [0, 4],
  [0, 1],
  [9, 10],
  [9, 11],
  [9, 12],
  [9, 13],
  [9, 15],
  [1, 6],
  [1, 7],
  [6, 5],
  [5, 11],
  [5, 3],
  [3, 4],
  [3, 14],
  [2, 15],
  [2, 13],
  [7, 12],
  [8, 10],
  [10, 12],
  [11, 5],
  [4, 16]
];

function mulberry32(a: number) {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decorative night-lights map — not wired to simulation logic. */
export function IndiaMapVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef(false);
  const [hoverCity, setHoverCity] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const end = () => {
      drag.current = false;
    };
    window.addEventListener('mouseup', end);
    window.addEventListener('blur', end);
    return () => {
      window.removeEventListener('mouseup', end);
      window.removeEventListener('blur', end);
    };
  }, []);

  const rural = useMemo(() => {
    const rand = mulberry32(0x4e494748);
    const pts: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 260; i++) {
      pts.push({
        x: 88 + rand() * 230,
        y: 32 + rand() * 420,
        r: 0.2 + rand() * 0.75,
        o: 0.06 + rand() * 0.28
      });
    }
    return pts;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const dz = e.deltaY > 0 ? -0.09 : 0.09;
    setZoom((z) => Math.min(2.6, Math.max(1, z + dz)));
  }, []);

  const mapTransform = `translate(${200 + pan.x},${250 + pan.y}) scale(${zoom}) translate(-200,-250)`;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ aspectRatio: '4/5', maxHeight: '520px', touchAction: 'none' }}
      onWheel={onWheel}
      onMouseDown={() => {
        drag.current = true;
      }}
      onMouseUp={() => {
        drag.current = false;
      }}
      onMouseLeave={() => {
        drag.current = false;
        setHoverCity(null);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }}
      onMouseMove={(e) => {
        if (drag.current && zoom > 1.02) {
          setPan((p) => ({
            x: p.x + e.movementX / zoom,
            y: p.y + e.movementY / zoom
          }));
        }
        if (containerRef.current) {
          const r = containerRef.current.getBoundingClientRect();
          setTipPos({ x: e.clientX - r.left, y: e.clientY - r.top });
        }
      }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-2xl bg-black" />

      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(40,38,28,0.35) 0%, #000000 72%)',
          pointerEvents: 'none'
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full rounded-2xl"
        viewBox="0 0 400 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'hidden', cursor: zoom > 1.02 ? 'grab' : 'default' }}
      >
        <defs>
          <clipPath id="indiaNightClip">
            <path d={INDIA_MAIN_D} />
            <path d={INDIA_JK_D} />
            <path d={INDIA_NE_D} />
            <path d={SRI_LANKA_D} />
          </clipPath>
          <filter id="nightBloom" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="metroBloom" x="-250%" y="-250%" width="600%" height="600%">
            <feGaussianBlur stdDeviation="4" result="b2" />
            <feGaussianBlur stdDeviation="1.2" result="b1" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={mapTransform}>
          {/* Ultra-subtle land read (not a visible border) */}
          <path
            d={INDIA_MAIN_D}
            fill={`${LIGHT} 0.04)`}
            stroke="none"
          />
          <path d={INDIA_JK_D} fill={`${LIGHT} 0.035)`} stroke="none" />
          <path d={INDIA_NE_D} fill={`${LIGHT} 0.035)`} stroke="none" />
          <path d={SRI_LANKA_D} fill={`${LIGHT} 0.03)`} stroke="none" />

          {/* Rural / corridor pinpricks */}
          <g clipPath="url(#indiaNightClip)">
            {rural.map((p, i) => (
              <circle
                key={`r-${i}`}
                cx={p.x}
                cy={p.y}
                r={Number.isFinite(p.r) ? p.r : 0.5}
                fill={`${LIGHT} ${p.o})`}
              />
            ))}
          </g>

          {/* Bright corridors between hubs */}
          {CONNECTIONS.map(([a, b], i) => (
            <line
              key={`c-${i}`}
              x1={CITIES[a].x}
              y1={CITIES[a].y}
              x2={CITIES[b].x}
              y2={CITIES[b].y}
              stroke={`${LIGHT_SOFT} 0.14)`}
              strokeWidth={1.1}
              strokeLinecap="round"
              filter="url(#nightBloom)"
            />
          ))}

          {/* Metro glows */}
          {CITIES.map((city) => {
            const b = city.brightness;
            return (
              <g key={city.name} filter="url(#metroBloom)" style={{ pointerEvents: 'none' }}>
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={Number.isFinite(city.size) ? city.size * 4.2 : 6}
                  fill={`${LIGHT} ${b * 0.1})`}
                />
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={Number.isFinite(city.size) ? city.size * 2.4 : 4}
                  fill={`${LIGHT} ${b * 0.22})`}
                />
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={Number.isFinite(city.size) ? city.size * 1.1 : 2.2}
                  fill={`${LIGHT} ${0.75 * b})`}
                />
              </g>
            );
          })}

          {/* Hit targets + cores (interactive) */}
          {CITIES.map((city) => (
            <g key={`hit-${city.name}`}>
              <circle
                cx={city.x}
                cy={city.y}
                r={14}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverCity(city.name)}
                onMouseLeave={() => setHoverCity((n) => (n === city.name ? null : n))}
              />
              <circle
                cx={city.x}
                cy={city.y}
                r={Number.isFinite(city.size) ? city.size * 0.55 : 2}
                fill={`${LIGHT} 0.95)`}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      {hoverCity && (
        <motion.div
          className="pointer-events-none absolute z-20 rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest"
          style={{
            left: Math.min(
              (containerRef.current?.clientWidth ?? 400) - 140,
              Math.max(8, tipPos.x + 12)
            ),
            top: Math.max(8, tipPos.y - 36),
            color: 'rgba(255,253,231,0.92)',
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(255,253,231,0.2)',
            boxShadow: '0 0 20px rgba(255,248,220,0.12)'
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {hoverCity}
        </motion.div>
      )}

      {/* Decorative caption only */}
      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[200px] font-mono text-[8px] uppercase leading-relaxed tracking-[0.18em]"
        style={{ color: 'rgba(255,253,231,0.35)' }}
      >
        Night radiance · illustrative
        <div className="mt-1 normal-case tracking-normal opacity-70">
          Scroll zoom · drag pan (zoomed) · double-click reset · hover cities
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)'
        }}
      />
    </div>
  );
}
