import { motion } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';

interface AstraNeuralVisualProps {
  isRunning?: boolean;
}

export function AstraNeuralVisual({ isRunning }: AstraNeuralVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapMountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const didFallbackRef = useRef(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const onLeave = () => {
      setTilt({ rx: 0, ry: 0 });
      setParallax({ x: 0, y: 0 });
    };
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('mouseleave', onLeave);
    return () => el.removeEventListener('mouseleave', onLeave);
  }, [setParallax]);

  const nodes = useMemo(() => {
    return [
      { id: 'Delhi', x: 44, y: 26 },
      { id: 'Mumbai', x: 30, y: 52 },
      { id: 'Kolkata', x: 66, y: 44 },
      { id: 'Chennai', x: 52, y: 74 },
      { id: 'Bengaluru', x: 49, y: 78 },
      { id: 'Hyderabad', x: 50, y: 64 },
      { id: 'Ahmedabad', x: 28, y: 40 },
    ];
  }, []);

  const stateStops = useMemo(
    () => [
      { name: 'Delhi', center: [77.209, 28.6139] as [number, number], zoom: 7.2 },
      { name: 'Maharashtra', center: [75.7139, 19.7515] as [number, number], zoom: 6.35 },
      { name: 'West Bengal', center: [87.855, 22.9868] as [number, number], zoom: 6.55 },
      { name: 'Tamil Nadu', center: [78.6569, 11.1271] as [number, number], zoom: 6.55 },
      { name: 'Karnataka', center: [75.7139, 15.3173] as [number, number], zoom: 6.55 },
      { name: 'Gujarat', center: [71.1924, 22.2587] as [number, number], zoom: 6.45 },
      { name: 'Assam', center: [92.9376, 26.2006] as [number, number], zoom: 6.8 },
      { name: 'Rajasthan', center: [74.2179, 27.0238] as [number, number], zoom: 6.15 },
    ],
    []
  );

  const workerPins = useMemo(() => {
    return [
      { id: 'Arjun Mehta', meta: 'Blinkit', x: 44, y: 26 },
      { id: 'Kabir Sharma', meta: 'Swiggy', x: 30, y: 52 },
      { id: 'Rohit Iyer', meta: 'Zepto', x: 49, y: 78 },
      { id: 'Aditya Nair', meta: 'BigBasket', x: 52, y: 74 },
      { id: 'Sameer Khan', meta: 'Flipkart', x: 66, y: 44 },
      { id: 'Vikram Singh', meta: 'Amazon', x: 50, y: 64 },
    ];
  }, []);

  const links = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const get = (id: string) => byId.get(id)!;
    return [
      ['Delhi', 'Mumbai'],
      ['Delhi', 'Kolkata'],
      ['Mumbai', 'Bengaluru'],
      ['Hyderabad', 'Chennai'],
      ['Bengaluru', 'Chennai'],
      ['Ahmedabad', 'Mumbai'],
    ].map(([a, b]) => ({ a: get(a), b: get(b) }));
  }, [nodes]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const max = 5.5;
    const ry = (px - 0.5) * max * 2;
    const rx = -(py - 0.5) * max * 2;
    setTilt({ rx, ry });
    setParallax({ x: (px - 0.5) * 10, y: (py - 0.5) * 10 });
  };

  useEffect(() => {
    const mount = mapMountRef.current;
    if (!mount) return;

    const applyMarkers = (map: maplibregl.Map) => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      for (const p of workerPins) {
        const el = document.createElement('div');
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.transform = 'translateY(-10px)';
        el.style.filter = 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))';
        el.style.cursor = 'default';
        el.title = `${p.id} • ${p.meta}`;

        el.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; transform: translateX(-6px);">
            <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex:0 0 auto;">
              <defs>
                <linearGradient id="pinRed" x1="18" y1="10" x2="46" y2="54" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#ff3b3b" />
                  <stop offset="1" stop-color="#c80000" />
                </linearGradient>
              </defs>
              <path d="M32 2C20.4 2 11 11.4 11 23c0 15.7 18.9 38.4 20.1 39.8.5.6 1.3.6 1.8 0C34.1 61.4 53 38.7 53 23 53 11.4 43.6 2 32 2z" fill="url(#pinRed)"/>
              <circle cx="32" cy="23" r="10" fill="#ffffff"/>
            </svg>
            <div style="
              font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
              font-size: 11px;
              line-height: 1;
              padding: 7px 10px;
              border-radius: 999px;
              background: rgba(255,255,255,0.92);
              color: rgba(0,0,0,0.9);
              border: 1px solid rgba(0,0,0,0.18);
              box-shadow: 0 10px 22px rgba(0,0,0,0.22);
              white-space: nowrap;
            ">${p.id.split(' ')[0]} · ${p.meta}</div>
          </div>
        `;

        // rough lon/lat mapping by city anchors (original pins are tied to metros)
        const metro = p.meta;
        const ll: [number, number] =
          metro === 'Blinkit' ? [77.1025, 28.7041] :
          metro === 'Swiggy' ? [72.8777, 19.076] :
          metro === 'Zepto' ? [77.5946, 12.9716] :
          metro === 'BigBasket' ? [80.2707, 13.0827] :
          metro === 'Flipkart' ? [88.3639, 22.5726] :
          [78.4867, 17.385];

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(ll).addTo(map);
        markersRef.current.push(marker);
      }
    };

    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mount,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [78.9629, 22.5937],
      zoom: 5.2,
      bearing: -18,
      pitch: 18,
      interactive: false,
    });

    mapRef.current = map;

    const onLoad = () => {
      applyMarkers(map);
      map.resize();
      requestAnimationFrame(() => map.resize());
      setMapReady(true);
    };

    const onIdle = () => {
      setMapReady(true);
    };

    const onError = (e: any) => {
      setMapReady(false);
      // eslint-disable-next-line no-console
      console.error('[AstraNeuralVisual] MapLibre error:', e?.error ?? e);

      if (!didFallbackRef.current) {
        didFallbackRef.current = true;
        try {
          map.setStyle('https://demotiles.maplibre.org/style.json');
        } catch {
          // ignore
        }
      }
    };

    map.on('load', onLoad);
    map.on('idle', onIdle);
    map.on('error', onError);

    return () => {
      map.off('load', onLoad);
      map.off('idle', onIdle);
      map.off('error', onError);
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [workerPins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let idx = 0;
    const tick = () => {
      const s = stateStops[idx % stateStops.length];
      idx++;
      if (!s) return;
      map.flyTo({
        center: s.center,
        zoom: s.zoom,
        bearing: -18 + (idx % 3) * 8,
        pitch: 18 + (idx % 2) * 7,
        duration: 1600,
        essential: true,
      });
    };

    const t0 = window.setTimeout(tick, 900);
    const id = window.setInterval(tick, 5000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [stateStops]);

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full"
      style={{ aspectRatio: '4/5', maxHeight: '520px', transformStyle: 'preserve-3d', position: 'relative', width: '100%' }}
      animate={{ rotateX: tilt.rx, rotateY: tilt.ry }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.6 }}
      onMouseMove={onMove}
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-2xl bg-black"
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 24, background: '#000' }}
      />

      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24,
          background:
            'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.94) 72%, #000000 100%)',
          pointerEvents: 'none'
        }}
      />

      <motion.div
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: 24,
          transform: `translate(${parallax.x * 0.18}px, ${parallax.y * 0.18}px)`,
          filter: 'none'
        }}
      >
        <div
          ref={mapMountRef}
          className="absolute inset-0"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#0b0b0b' }}
        />

        {!mapReady && (
          <motion.div
            className="absolute inset-0"
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 60% 48% at 55% 46%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 70%, #000 100%)'
            }}
            animate={{ opacity: [0.55, 0.72, 0.55] }}
            transition={{ duration: isRunning ? 1.8 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.62) 100%)'
        }}
      />
    </motion.div>
  );
}
