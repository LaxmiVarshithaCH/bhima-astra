import { motion, AnimatePresence } from 'framer-motion';

export interface PremiumModelResult {
  basePremium: number;           // plan tier base
  personalizedPremium: number;   // Ridge output
  expectedLoss: number;          // E[L] = disruption_prob × expected_income
  expenseLoading: number;        // 10–15%
  riskMargin: number;            // 20–30%
  cityMultiplier: number;        // tier multiplier
  planTier: 'basic' | 'standard' | 'premium';
  zoneRiskScore: number;         // 0–1
}

interface PremiumModelCardProps {
  result: PremiumModelResult | null;
  isActive: boolean;
}

const TIER_COLOR: Record<string, string> = {
  basic: 'rgba(255,255,255,0.45)',
  standard: 'rgba(255,255,255,0.72)',
  premium: 'rgba(255,255,255,0.95)',
};

function Coefficient({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span className="feat-k">{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>{value}</span>
      </div>
      <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 1, background: 'rgba(255,255,255,0.35)' }}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

export function PremiumModelCard({ result, isActive }: PremiumModelCardProps) {
  const delta = result ? result.personalizedPremium - result.basePremium : 0;
  const deltaUp = delta >= 0;

  return (
    <motion.div
      className="nuvia-card"
      id="premium-model-card"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="card-eyebrow">Premium Calculation Model</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.06em', marginTop: 2 }}>
            premium_model.pkl · Ridge Regression (α=1.0)
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
          {isActive ? 'RUNNING' : 'RIDGE v2'}
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
            Awaiting risk score…
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Premium hero */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
              <div>
                <div className="feat-k" style={{ marginBottom: 4 }}>Personalised Premium</div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: TIER_COLOR[result.planTier],
                  letterSpacing: '-0.01em',
                }}>
                  ₹{result.personalizedPremium.toFixed(2)}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>/week</span>
                </div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <div className="feat-k" style={{ marginBottom: 4 }}>vs Base</div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: deltaUp ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                }}>
                  {deltaUp ? '↑' : '↓'} ₹{Math.abs(delta).toFixed(2)} vs ₹{result.basePremium}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', marginBottom: 4 }}>
                <div className="feat-k" style={{ marginBottom: 4 }}>Plan</div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4,
                  color: TIER_COLOR[result.planTier],
                  textTransform: 'uppercase',
                }}>
                  {result.planTier}
                </div>
              </div>
            </div>

            {/* Ridge Coefficients — actuarial breakdown */}
            <div style={{ marginBottom: 14 }}>
              <div className="feat-k" style={{ marginBottom: 8 }}>Ridge Coefficients (Actuarial Audit Trail)</div>
              <Coefficient
                label="E[L] — Expected Loss"
                value={`₹${result.expectedLoss.toFixed(0)}`}
                width={Math.min(95, (result.expectedLoss / 800) * 100)}
              />
              <Coefficient
                label="Expense Loading (10–15%)"
                value={`₹${result.expenseLoading.toFixed(0)}`}
                width={Math.min(60, (result.expenseLoading / 120) * 60)}
              />
              <Coefficient
                label="Risk Margin (20–30%)"
                value={`₹${result.riskMargin.toFixed(0)}`}
                width={Math.min(75, (result.riskMargin / 200) * 75)}
              />
            </div>

            {/* Zone risk + city multiplier row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="feat-k" style={{ marginBottom: 2 }}>Zone Risk Score</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                  {result.zoneRiskScore.toFixed(4)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="feat-k" style={{ marginBottom: 2 }}>City Multiplier</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                  {result.cityMultiplier.toFixed(2)}×
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="feat-k" style={{ marginBottom: 2 }}>Cap Constraint</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  ±20% of base
                </div>
              </div>
            </div>

            {/* IRDAI note */}
            <div style={{
              marginTop: 10,
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'rgba(255,255,255,0.22)',
              letterSpacing: '0.04em',
            }}>
              IRDAI compliant · signed coefficients · no black-box pricing
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
