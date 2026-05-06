import { motion } from 'framer-motion';
import type { Worker } from '../../lib/types';

interface WorkerCardProps {
  worker: Worker;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  const f = worker.features;

  return (
    <motion.div
      className="nuvia-card"
      id="worker-card"
      whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-eyebrow">Worker Profile</div>
      <div className="worker-name-row">
        <div className="worker-avatar">{worker.initials}</div>
        <div>
          <div className="worker-name">{worker.name}</div>
          <div className="worker-id">
            {worker.id} · {worker.platform} · {worker.city}
          </div>
        </div>
        {worker.synthetic && (
          <span className="synthetic-badge">SYNTHETIC</span>
        )}
      </div>

      <div className="worker-tags">
        {worker.tags.map((tag, idx) => (
          <span key={idx} className={`tag ${tag.cls}`}>
            {tag.label}
          </span>
        ))}
      </div>

      <div className="worker-features">
        {[
          { k: 'GPS Delta',        v: `${f.gps_tower_delta}m` },
          { k: 'Accel Variance',   v: f.accelerometer_variance.toFixed(3) },
          { k: 'Claim Response',   v: `${f.claim_response_time_sec}s` },
          { k: 'App Interactions', v: `${f.app_interaction_count}` },
          { k: 'Location Jump',    v: f.location_jump_flag ? 'Yes' : 'No' }
        ].map(({ k, v }) => (
          <div className="feat-row" key={k}>
            <span className="feat-k">{k}</span>
            <span className="feat-v">{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}