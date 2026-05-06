import React from "react";

export interface DailyStats {
  total_claims_today: number;
  approved_payouts: number;
  flagged_cases: number;
  avg_processing_time_sec: number;
  new_registrations: number;
  offline_workers: number;
}

interface ManagerStatsProps {
  stats: DailyStats;
}

function formatProcessingTime(sec: number): string {
  if (sec < 60) return `${sec.toFixed(0)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

export const ManagerStats: React.FC<ManagerStatsProps> = ({ stats }) => {
  const items: {
    label: string;
    value: string | number;
    sub?: string;
    highlight?: boolean;
  }[] = [
    {
      label: "Claims Today",
      value: stats.total_claims_today,
      sub: "parametric auto-created",
    },
    {
      label: "Approved Payouts",
      value: stats.approved_payouts,
      sub: "released to workers",
      highlight: true,
    },
    {
      label: "Flagged Cases",
      value: stats.flagged_cases,
      sub: "pending fraud review",
    },
    {
      label: "Avg Processing",
      value: formatProcessingTime(stats.avg_processing_time_sec),
      sub: "claim to payout",
    },
    {
      label: "New Registrations",
      value: stats.new_registrations,
      sub: "today",
    },
    {
      label: "Offline Workers",
      value: stats.offline_workers,
      sub: "during active disruption",
    },
  ];

  return (
    <div className="manager-stats-grid">
      {items.map((item) => (
        <div
          key={item.label}
          className={`stat-card manager-stats-cell${item.highlight ? " card-amber" : ""}`}
        >
          <div className="stat-label">{item.label}</div>
          <div
            className={`stat-value-xl${item.highlight ? " payout-green" : ""}`}
            style={{ fontSize: 28, lineHeight: 1.1 }}
          >
            {item.value}
          </div>
          {item.sub && <div className="stat-meta">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
};
