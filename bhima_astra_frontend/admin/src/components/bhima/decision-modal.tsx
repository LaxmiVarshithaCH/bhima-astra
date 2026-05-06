import { motion, AnimatePresence } from 'framer-motion';
import type { DecisionResult, FeatureImportance, Worker } from '../../lib/types';
import { REASON_LABELS, REASON_SUBS } from '../../lib/data';

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  decisionResult: DecisionResult | null;
  featureImportance: FeatureImportance[] | null;
  worker: Worker | null;
}

const PAYOUT_MAP: Record<string, string> = {
  FULL_RELEASE:    'Full Release — Immediate transfer',
  PARTIAL_RELEASE: 'Partial Release — 48h investigative hold',
  ON_HOLD:         'On Hold — Manual investigation required'
};

const PAYOUT_ICONS: Record<string, string> = {
  FULL_RELEASE:    '\u2713',
  PARTIAL_RELEASE: '\u23F8',
  ON_HOLD:         '\u2717'
};

export function DecisionModal({
  isOpen,
  onClose,
  decisionResult,
  featureImportance,
  worker
}: DecisionModalProps) {
  if (!decisionResult || !worker) return null;

  const {
    decision, finalScore, percentile, behaviorScore,
    ruleScore, payoutStatus, primary_reason, all_reasons,
    clusterSize, tabularProb
  } = decisionResult;

  // Monochrome badge classes — approve=bright, block=dim
  const clsMap: Record<string, string> = {
    APPROVE: 'approve',
    REVIEW:  'review',
    BLOCK:   'block'
  };

  let sub = REASON_SUBS[primary_reason] || '';
  if (primary_reason === 'ring_cluster')
    sub = `Worker connected to a ${clusterSize}-node fraud cluster.`;
  if (primary_reason === 'behavioral_anomaly')
    sub = `LSTM behavior score ${behaviorScore.toFixed(2)} exceeds anomaly threshold of 0.70.`;
  if (primary_reason === 'high_tabular_prob')
    sub = `XGBoost model probability: ${(tabularProb * 100).toFixed(1)}%`;

  return (
    <div
      className={`modal-overlay ${isOpen ? 'show' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="modal-box"
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 16, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div className="modal-header">
              <div className="modal-eyebrow">Stage 4 — Astra Decision Engine</div>
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Decision Badge */}
              <div className="modal-verdict-row">
                <div className={`verdict-badge ${clsMap[decision]}`}>
                  &#x25CF; {decision}
                </div>
                <div>
                  <div className="verdict-reason">
                    {REASON_LABELS[primary_reason] || primary_reason}
                  </div>
                  <div className="verdict-sub">{sub}</div>
                </div>
              </div>

              {/* Score Grid */}
              <div className="modal-score-grid">
                {[
                  { label: 'Final Score',    val: finalScore.toFixed(3) },
                  { label: 'Percentile',     val: `P${Math.round(percentile * 100)}` },
                  { label: 'Behavior Score', val: behaviorScore.toFixed(3) },
                  { label: 'Rule Flags',     val: `${Math.round(ruleScore * 4)} / 4` }
                ].map(({ label, val }) => (
                  <div className="mscore-cell" key={label}>
                    <div className="mscore-label">{label}</div>
                    <div className="mscore-val">{val}</div>
                  </div>
                ))}
              </div>

              {/* Payout Row */}
              <div className="modal-payout-row">
                <div>
                  <div className="modal-payout-label">Payout Decision</div>
                  <div className="modal-payout-val">
                    {PAYOUT_ICONS[payoutStatus]} {PAYOUT_MAP[payoutStatus] || payoutStatus}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="modal-payout-label">Worker</div>
                  <div className="modal-payout-val">
                    {worker.name} [{worker.id}]
                  </div>
                </div>
              </div>

              {/* XGBoost Feature Importance */}
              <div className="feat-importance-wrap">
                <div className="feat-importance-title">XGBoost Feature Importance</div>
                {featureImportance?.map((f) => (
                  <div key={f.name} className="feat-imp-row">
                    <span className="feat-imp-name">{f.name}</span>
                    <div className="feat-imp-track">
                      <motion.div
                        className="feat-imp-bar"
                        initial={{ width: 0 }}
                        animate={{ width: `${f.importance}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="feat-imp-pct">{f.importance.toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* All Reasons */}
              <div className="all-reasons-wrap">
                {all_reasons.map((r, i) => (
                  <span key={r} className={`reason-chip ${i === 0 ? 'primary' : ''}`}>
                    {REASON_LABELS[r] || r}
                  </span>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={onClose}>
                Acknowledge &amp; Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}