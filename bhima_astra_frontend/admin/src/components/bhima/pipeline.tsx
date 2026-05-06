import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PipelineStage } from '../../lib/types';

interface PipelineProps {
  stages: PipelineStage[];
}

const STAGE_INFO = [
  { name: 'Monitor + Trigger', file: 'disruption.csv · trigger_agent.py' },
  { name: 'Stage 1 — Rules', file: 'fraud_rules.py' },
  { name: 'Stage 2 — LSTM', file: 'behavior_model.py' },
  { name: 'Stage 3 — Graph', file: 'fraud_graph.py' },
  { name: 'Stage 4 — Decision', file: 'decision_engine.py' }
];

function usePipelineGridTemplate(): string {
  const [template, setTemplate] = useState('repeat(5, minmax(0, 1fr))');

  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      if (w <= 740) setTemplate('minmax(0, 1fr)');
      else if (w <= 1200) setTemplate('repeat(2, minmax(0, 1fr))');
      else setTemplate('repeat(5, minmax(0, 1fr))');
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  return template;
}

export function Pipeline({ stages }: PipelineProps) {
  const gridTemplateColumns = usePipelineGridTemplate();

  return (
    <section className="pipeline-section" id="pipeline">
      <div className="section-eyebrow">Processing Stages</div>
      <div className="pipeline-strip" style={{ gridTemplateColumns }}>
        {STAGE_INFO.map((info, idx) => {
          const state = stages[idx] || 'idle';
          const stateClass = state === 'idle' ? '' : state;

          return (
            <motion.div
              key={idx}
              className={`pipe-stage ${stateClass}`}
              id={`pipe-${idx}`}
              animate={
                state === 'running'
                  ? { borderColor: 'rgba(255,255,255,0.30)' }
                  : state === 'done'
                  ? { borderColor: 'rgba(255,255,255,0.14)' }
                  : { borderColor: 'rgba(255,255,255,0.06)' }
              }
              transition={{ duration: 0.5 }}
            >
              <div className="pipe-num">{String(idx + 1).padStart(2, '0')}</div>
              <div className="pipe-body">
                <div className="pipe-name">{info.name}</div>
                <div className="pipe-file">{info.file}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
