import { motion } from 'framer-motion';
import type { RuleEngineResult } from '../../lib/types';

interface RulesCardProps {
  ruleResult: RuleEngineResult | null;
}

const FLAG_LABELS: Record<string, string> = {
  gps_mismatch:    'GPS Mismatch',
  no_motion:       'No Motion',
  timing_anomaly:  'Timing Anomaly',
  device_blacklist:'Device Blacklist'
};

export function RulesCard({ ruleResult }: RulesCardProps) {
  const flags = ruleResult?.rule_flags || [];
  const decision = ruleResult?.rule_decision;
  const ruleScore = flags.length / 4;

  let decisionText = '— Awaiting Simulation —';
  let decisionColor = 'rgba(255,255,255,0.2)';
  let cardClass = 'nuvia-card';

  if (decision === 'REVIEW') {
    decisionText = `\u2691 Review — ${flags.length} flag${flags.length > 1 ? 's' : ''} raised`;
    decisionColor = 'rgba(255,255,255,0.9)';
    cardClass = 'nuvia-card card-amber';
  } else if (decision === 'PASS') {
    decisionText = '\u2713 Pass — No flags raised';
    decisionColor = 'rgba(255,255,255,0.7)';
  }

  return (
    <motion.div
      className={cardClass}
      id="card-rules"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-eyebrow">Stage 1 — Rule Engine</div>
      <div className="rule-decision" style={{ color: decisionColor }}>
        {decisionText}
      </div>

      <div className="rule-flags">
        {Object.entries(FLAG_LABELS).map(([key, label]) => (
          <motion.div
            key={key}
            className={`flag-chip ${flags.includes(key) ? 'triggered' : ''}`}
            animate={
              flags.includes(key)
                ? { borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }
                : { borderColor: 'rgba(255,255,255,0.08)', color: 'var(--grey-600)' }
            }
            transition={{ duration: 0.4 }}
          >
            {label}
          </motion.div>
        ))}
      </div>

      <div className="rule-score-wrap">
        <span className="feat-k">Rule Score</span>
        <div className="rule-score-bar-wrap">
          <motion.div
            className="rule-score-bar"
            animate={{ width: `${ruleScore * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="feat-v">{flags.length} / 4</span>
      </div>
    </motion.div>
  );
}