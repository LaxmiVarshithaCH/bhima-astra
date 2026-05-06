import { motion, AnimatePresence } from 'framer-motion';
import type { PayoutUiPhase } from '../../lib/types';

interface PayoutCardProps {
  phase: PayoutUiPhase;
  amount: number | null;
  upiRef: string | null;
}

export function PayoutCard({ phase, amount, upiRef }: PayoutCardProps) {
  const sweep = phase === 'processing';
  const amt = amount != null ? `₹${amount.toLocaleString('en-IN')}` : '—';

  let statusLine = 'Awaiting fraud validation…';
  if (phase === 'processing') statusLine = `${amt} → Processing…`;
  else if (phase === 'success') statusLine = `${amt} → SUCCESS ✓`;
  else if (phase === 'partial') statusLine = `${amt} → PARTIAL RELEASE (48h review)`;
  else if (phase === 'held') statusLine = `${amt !== '—' ? amt + ' → ' : ''}ON HOLD — transfer suspended`;

  return (
    <motion.div
      className={`nuvia-card${sweep ? ' sweep-active' : ''}`}
      id="payout-agent"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-eyebrow">Payout Agent</div>

      <div className="feat-k" style={{ marginBottom: 12 }}>
        UPI rail simulation
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase + (amount ?? 0)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            letterSpacing: '0.04em',
            color: phase === 'success' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)',
            minHeight: 22
          }}
        >
          {statusLine}
        </motion.div>
      </AnimatePresence>

      <div className="gps-status-block" style={{ marginTop: 16 }}>
        <div>
          <div className="feat-k">Settlement ref</div>
          <div className="gps-delta-val">{upiRef ?? '—'}</div>
        </div>
        <motion.div
          className="gps-badge ok"
          animate={phase === 'processing' ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
          transition={{ duration: 1.6, repeat: phase === 'processing' ? Infinity : 0, ease: 'easeInOut' }}
        >
          {phase === 'idle' && 'STANDBY'}
          {phase === 'processing' && 'SENDING'}
          {phase === 'success' && 'SETTLED'}
          {phase === 'partial' && 'QUARANTINE'}
          {phase === 'held' && 'BLOCKED'}
        </motion.div>
      </div>
    </motion.div>
  );
}
