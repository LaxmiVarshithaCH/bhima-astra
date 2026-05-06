import { motion } from 'framer-motion';
import type { BehaviorResult } from '../../lib/types';
import { Sparkline } from './sparkline';

interface BehavioralCardProps {
  behaviorResult: BehaviorResult | null;
  motionTrace: number[];
  gpsDelta: number;
}

export function BehavioralCard({ behaviorResult, motionTrace, gpsDelta }: BehavioralCardProps) {
  const score       = behaviorResult?.behavior_score ?? 0;
  const gpsComp     = behaviorResult?.gpsComp        ?? 0;
  const motionComp  = behaviorResult?.motionComp     ?? 0;
  const interactComp= behaviorResult?.interactComp   ?? 0;
  const locationJump= behaviorResult?.locationJump   ?? 0;

  // Monochrome semantics: high anomaly = bright white, normal = dim
  let scoreOpacity = '0.25';
  let tagText = 'AWAITING';
  let tagCls = '';

  if (behaviorResult) {
    if (score > 0.70) {
      scoreOpacity = '1';
      tagText = 'HIGH ANOMALY';
      tagCls = 'anomaly';
    } else if (score > 0.30) {
      scoreOpacity = '0.7';
      tagText = 'SUSPICIOUS';
      tagCls = 'suspicious';
    } else {
      scoreOpacity = '0.5';
      tagText = 'NORMAL';
    }
  }

  let gpsBadgeClass = 'gps-badge ok';
  let gpsBadgeText  = 'NOMINAL';
  if (gpsDelta > 500)      { gpsBadgeClass = 'gps-badge fail'; gpsBadgeText = 'MISMATCH'; }
  else if (gpsDelta > 200) { gpsBadgeClass = 'gps-badge warn'; gpsBadgeText = 'DEGRADED'; }

  return (
    <motion.div
      className="nuvia-card"
      id="behavioral"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-eyebrow">Behavioral Blueprint</div>

      <div className="behavior-score-wrap">
        <motion.div
          className="behavior-score-val"
          style={{ color: `rgba(255,255,255,${scoreOpacity})` }}
          animate={{ color: `rgba(255,255,255,${scoreOpacity})` }}
          transition={{ duration: 0.6 }}
        >
          {score.toFixed(2)}
        </motion.div>
        <div className="behavior-score-meta">
          <div className="behavior-score-label">Pattern Anomaly Score</div>
          <div className={`behavior-score-tag ${tagCls}`}>{tagText}</div>
        </div>
      </div>

      {/* Sparkline — animated draw via useEffect in Sparkline component */}
      <div className="sparkline-label">Motion Variance</div>
      <div className="sparkline-wrap">
        <Sparkline data={motionTrace} />
      </div>

      {/* Component bars */}
      <div className="components-label">Signal Components</div>
      <div className="comp-bars">
        {[
          { label: 'GPS Delta',    cls: 'sage',  val: gpsComp * 100 },
          { label: 'Motion',       cls: 'amber', val: (1 - motionComp) * 100 },
          { label: 'Interaction',  cls: 'clay',  val: (1 - interactComp) * 100 },
          { label: 'Loc Jump',     cls: 'red',   val: locationJump * 100 }
        ].map(({ label, cls, val }) => (
          <div className="comp-row" key={label}>
            <span className="comp-name">{label}</span>
            <div className="comp-track">
              <motion.div
                className={`comp-fill ${cls}`}
                animate={{ width: `${val.toFixed(0)}%` }}
                transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
            <span className="comp-pct">{val.toFixed(0)}%</span>
          </div>
        ))}
      </div>

      {/* GPS Status */}
      <div className="gps-status-block">
        <div>
          <div className="feat-k">GPS Integrity</div>
          <div className="gps-delta-val">
            Delta: {behaviorResult ? `${gpsDelta.toFixed(0)} m` : '— m'}
          </div>
        </div>
        <div className={gpsBadgeClass}>{gpsBadgeText}</div>
      </div>
    </motion.div>
  );
}