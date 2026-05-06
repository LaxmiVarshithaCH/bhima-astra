import React from "react";

export type ZoneStatus = "active" | "alert" | "stable";

export interface Zone {
  zone_id: string;
  zone_name: string;
  status: ZoneStatus;
  active_workers: number;
  disruption_level: "none" | "low" | "medium" | "high" | "critical";
  composite_score: number;
  pending_flags: number;
  active_payouts: number;
}

interface ZoneOverviewProps {
  zones: Zone[];
}

const DISRUPTION_LABEL: Record<Zone["disruption_level"], string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const STATUS_LABEL: Record<ZoneStatus, string> = {
  active: "Active",
  alert: "Alert",
  stable: "Stable",
};

export const ZoneOverview: React.FC<ZoneOverviewProps> = ({ zones }) => {
  return (
    <div className="zone-overview-grid">
      {zones.map((zone) => (
        <div
          key={zone.zone_id}
          className={`stat-card zone-card zone-card--${zone.status}`}
        >
          {/* Toplight highlight via ::after in CSS */}
          <div className="zone-card__header">
            <span className="stat-label">{zone.zone_id}</span>
            <span
              className={`zone-status-pill zone-status-pill--${zone.status}`}
            >
              {zone.status === "alert" && (
                <span className="pulse-dot" style={{ marginRight: 5 }} />
              )}
              {STATUS_LABEL[zone.status]}
            </span>
          </div>

          <div className="zone-card__name">{zone.zone_name}</div>

          <div className="zone-card__score-row">
            <span className="zone-card__score-label">Composite</span>
            <span className="zone-card__score-val">
              {(zone.composite_score * 100).toFixed(0)}
              <span className="zone-card__score-unit">%</span>
            </span>
          </div>

          {/* Score bar */}
          <div className="mini-bar-wrap" style={{ marginBottom: 14 }}>
            <div
              className="mini-bar-fill"
              style={{
                width: `${zone.composite_score * 100}%`,
                opacity:
                  zone.status === "alert"
                    ? 0.9
                    : zone.status === "active"
                      ? 0.6
                      : 0.3,
              }}
            />
          </div>

          <div className="zone-card__meta-grid">
            <div className="zone-card__meta-item">
              <span className="pair-label">Workers</span>
              <span className="pair-val">{zone.active_workers}</span>
            </div>
            <div className="zone-card__meta-item">
              <span className="pair-label">Disruption</span>
              <span className={`pair-val pair-val--${zone.disruption_level}`}>
                {DISRUPTION_LABEL[zone.disruption_level]}
              </span>
            </div>
            <div className="zone-card__meta-item">
              <span className="pair-label">Flags</span>
              <span className="pair-val">{zone.pending_flags}</span>
            </div>
            <div className="zone-card__meta-item">
              <span className="pair-label">Payouts</span>
              <span className="pair-val">{zone.active_payouts}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
