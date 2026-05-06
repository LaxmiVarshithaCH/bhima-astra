import { motion, AnimatePresence } from 'framer-motion';

export interface IncomeModelResult {
  expectedIncome: number;       // ₹/day from Random Forest
  actualIncome: number;         // simulated actual
  incomeLoss: number;           // expectedIncome - actualIncome
  disruptionLossPct: number;    // income_loss_if_disrupted %
  weeklyBaseline: number;       // income_baseline_weekly
  modelVersion: string;
}

interface IncomeModelCardProps {
  result: IncomeModelResult | null;
  isActive: boolean;
}

function Bar({ pct, alert }: { pct: number; alert?: boolean }) {
  return (
    <div
      style={{
        height: 3,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        marginTop: 4,
      }}
    >
      <motion.div
        style={{
          height: '100%',
          borderRadius: 2,
          background: alert ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.38)',
        }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct * 100)}%` }}
        transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

export function IncomeModelCard({ result, isActive }: IncomeModelCardProps) {
  const lossHighlight = result ? result.disruptionLossPct > 50 : false;

  return (
    <motion.div
      className="nuvia-card"
      id="income-model-card"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="card-eyebrow">Income Prediction Model</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.06em', marginTop: 2 }}>
            income_model.pkl · RandomForestRegressor
          </div>
        </div>
        <motion.span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)',
            color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)',
            background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
          }}
          animate={isActive ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
          transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
        >
          {isActive ? 'RUNNING' : 'RF v2.1'}
        </motion.span>
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em' }}
          >
            Awaiting disruption event…
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Expected vs Actual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div className="feat-k" style={{ marginBottom: 3 }}>Expected Income</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                  ₹{result.expectedIncome.toLocaleString('en-IN')}
                </div>
                <div className="feat-k" style={{ fontSize: 9, marginTop: 2 }}>baseline/day</div>
                <Bar pct={result.expectedIncome / 3000} />
              </div>
              <div>
                <div className="feat-k" style={{ marginBottom: 3 }}>Actual Income</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                  ₹{result.actualIncome.toLocaleString('en-IN')}
                </div>
                <div className="feat-k" style={{ fontSize: 9, marginTop: 2 }}>disrupted day</div>
                <Bar pct={result.actualIncome / 3000} />
              </div>
            </div>

            {/* Income Loss */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${lossHighlight ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'}`,
                background: lossHighlight ? 'rgba(255,255,255,0.04)' : 'transparent',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="feat-k">Income Loss (Disruption)</span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  color: lossHighlight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
                  fontWeight: 600,
                }}>
                  −₹{result.incomeLoss.toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar pct={result.disruptionLossPct / 100} alert={lossHighlight} />
              </div>
              <div style={{ marginTop: 5, fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                {result.disruptionLossPct.toFixed(1)}% income suppression · payout anchored here
              </div>
            </div>

            {/* Weekly + model tag */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="feat-k">Weekly Baseline</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  ₹{result.weeklyBaseline.toLocaleString('en-IN')} / week
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="feat-k">R² Accuracy</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  0.87 · MAE ₹140/day
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
