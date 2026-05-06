import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { GraphFraudResult } from '../../lib/types';
import { GraphFraudWaveCanvas } from './graph-fraud-wave-canvas';

interface GraphFraudCardProps {
  graphResult: GraphFraudResult | null;
  clusterScore: number;
  isGraphActive: boolean;
}

export function GraphFraudCard({ graphResult, clusterScore, isGraphActive }: GraphFraudCardProps) {
  const highlightCluster = graphResult !== null && clusterScore >= 0.15;
  const sweep = isGraphActive;
  const prevGraphRef = useRef<GraphFraudResult | null>(null);
  const [waveSeed, setWaveSeed] = useState(() => Date.now());
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (graphResult) {
      if (!prevGraphRef.current) setWaveSeed(Date.now());
      prevGraphRef.current = graphResult;
    } else {
      prevGraphRef.current = null;
    }
  }, [graphResult]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <motion.div
      className={`nuvia-card${sweep ? ' sweep-active' : ''}`}
      id="graph-fraud"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-eyebrow">Stage 3 — Graph Model</div>

      <div className="feat-k" style={{ marginBottom: 10 }}>
        Co-claim worker graph · NetworkX + Louvain · 3D particle field (interactive)
      </div>

      <div
        ref={shellRef}
        className="relative w-full overflow-hidden rounded-xl bg-black"
        style={{
          height: 'clamp(380px, 56vh, 720px)',
          minHeight: 'clamp(380px, 56vh, 720px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div data-graph-viewport className="absolute inset-0">
          <GraphFraudWaveCanvas
            graphResult={graphResult}
            isGraphActive={isGraphActive}
            highlightCluster={highlightCluster}
            waveSeed={waveSeed}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: 'inset 0 0 48px rgba(0,0,0,0.65)',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 30%, transparent 65%, rgba(0,0,0,0.35) 100%)'
          }}
        />
      </div>

      <div className="gps-status-block" style={{ marginTop: 18 }}>
        <div>
          <div className="feat-k">Suspicious cluster</div>
          <div className="gps-delta-val">
            {graphResult ? `${graphResult.suspiciousClusterSize} nodes` : '—'}
          </div>
        </div>
        <div className="gps-badge ok">
          {graphResult ? `Q = ${graphResult.louvainModularity.toFixed(3)}` : 'IDLE'}
        </div>
      </div>
    </motion.div>
  );
}
