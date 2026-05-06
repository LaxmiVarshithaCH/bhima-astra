import { motion } from 'framer-motion';

interface StatsBandProps {
  totalPayout: number;
  claimCount: number;
  riskScore: number;
  latency: number;
}

export function StatsBand({ totalPayout, claimCount, riskScore, latency }: StatsBandProps) {
  // Risk semantics → monochrome: LOW=dim, CRITICAL=full white
  let riskLabel = 'LOW';
  let riskOpacity = '0.4';
  if (riskScore >= 0.80) {
    riskLabel = 'CRITICAL';
    riskOpacity = '1';
  } else if (riskScore >= 0.55) {
    riskLabel = 'HIGH';
    riskOpacity = '0.85';
  } else if (riskScore >= 0.25) {
    riskLabel = 'MEDIUM';
    riskOpacity = '0.65';
  }

  const riskPct = Math.min(1, Math.max(0, riskScore)) * 100;

  return (
    <section className="stats-band">
      <div className="stats-grid">
        {/* 1. System Status */}
        <motion.div
          className="stat-card"
          id="card-status"
          whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <div className="stat-label">System Status</div>
          <div className="stat-status-row">
            <span className="pulse-dot" />
            <span className="stat-value-lg" style={{ color: `rgba(255,255,255,0.9)` }}>
              ACTIVE
            </span>
          </div>
          <div className="stat-meta">All Oracle nodes operational</div>
          <div className="stat-row-pair">
            <span className="pair-label">UPTIME</span>
            <span className="pair-val">99.8%</span>
            <span className="pair-label">LATENCY</span>
            <span className="pair-val">{latency}ms</span>
          </div>
        </motion.div>

        {/* 2. Oracle Nodes */}
        <motion.div className="stat-card" whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <div className="stat-label">Active Oracle Nodes</div>
          <div className="stat-value-xl">24</div>
          <div className="stat-meta">Environmental + fraud nodes</div>
          <div className="mini-bar-wrap">
            <div className="mini-bar-fill" style={{ width: '80%' }} />
          </div>
        </motion.div>

        {/* 3. Verified Payouts */}
        <motion.div className="stat-card" whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <div className="stat-label">Total Verified Payouts</div>
          <div className="stat-value-xl payout-green">
            &#x20B9;{totalPayout.toLocaleString('en-IN')}
          </div>
          <div className="stat-meta">
            Across <span>{claimCount}</span> approved claims
          </div>
          <div className="stat-trend">
            <span className="trend-up">&#x2191; 12.4%</span> vs last cycle
          </div>
        </motion.div>

        {/* 4. Risk Level */}
        <motion.div
          className="stat-card"
          id="card-risk"
          whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <div className="stat-label">Current Risk Level</div>
          <div
            className="stat-value-xl"
            style={{ color: `rgba(255,255,255,${riskOpacity})` }}
          >
            {riskLabel}
          </div>
          <div className="risk-bar-wrap">
            <div className="risk-bar-track">
              <div className="risk-cursor" style={{ left: `${riskPct}%` }} />
            </div>
            <div className="risk-labels">
              <span>LOW</span><span>MED</span><span>HIGH</span><span>CRIT</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}