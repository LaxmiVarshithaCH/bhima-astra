import React from "react";

export type TriggerType =
  | "rainfall"
  | "heat"
  | "aqi"
  | "flood"
  | "curfew"
  | "outage";
export type TriggerStatus = "active" | "resolved" | "monitoring";
export type TriggerLevel = "L1" | "L2" | "L3";

export interface TriggerEvent {
  trigger_id: string;
  trigger_type: TriggerType;
  trigger_level: TriggerLevel;
  trigger_value: number;
  zone_id: string;
  status: TriggerStatus;
  workers_affected: number;
  fired_at: string; // ISO
  resolved_at?: string;
}

interface TriggerPanelProps {
  triggers: TriggerEvent[];
}

const TYPE_ICON: Record<TriggerType, string> = {
  rainfall: "◈",
  heat: "◉",
  aqi: "◎",
  flood: "◆",
  curfew: "■",
  outage: "▲",
};

const TYPE_UNIT: Record<TriggerType, string> = {
  rainfall: "mm",
  heat: "°C",
  aqi: "AQI",
  flood: "alert",
  curfew: "zone",
  outage: "flag",
};

const STATUS_LABEL: Record<TriggerStatus, string> = {
  active: "Active",
  resolved: "Resolved",
  monitoring: "Monitoring",
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export const TriggerPanel: React.FC<TriggerPanelProps> = ({ triggers }) => {
  const sorted = [...triggers].sort((a, b) => {
    /* Active first, then by fired_at descending */
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime();
  });

  return (
    <div className="nuvia-card trigger-panel-card">
      <div className="card-eyebrow">Trigger Events</div>

      <div className="trigger-list">
        {sorted.length === 0 && (
          <div className="trigger-empty">No trigger events today</div>
        )}

        {sorted.map((t) => (
          <div
            key={t.trigger_id}
            className={`trigger-row trigger-row--${t.status}`}
          >
            {/* Left: icon + type */}
            <div className="trigger-icon-col">
              <span className={`trigger-icon trigger-icon--${t.trigger_type}`}>
                {TYPE_ICON[t.trigger_type]}
              </span>
            </div>

            {/* Center */}
            <div className="trigger-body">
              <div className="trigger-top-row">
                <span className="trigger-type-label">
                  {t.trigger_type.toUpperCase()}
                </span>
                <span className="trigger-level-badge trigger-level-badge--{t.trigger_level}">
                  {t.trigger_level}
                </span>
              </div>
              <div className="trigger-bottom-row">
                <span className="trigger-zone">{t.zone_id}</span>
                <span className="trigger-value">
                  {t.trigger_value.toFixed(1)} {TYPE_UNIT[t.trigger_type]}
                </span>
                <span className="trigger-workers">
                  {t.workers_affected} workers
                </span>
              </div>
            </div>

            {/* Right: status + time */}
            <div className="trigger-right-col">
              <span
                className={`trigger-status-badge trigger-status-badge--${t.status}`}
              >
                {t.status === "active" && (
                  <span
                    className="pulse-dot"
                    style={{ width: 5, height: 5, marginRight: 5 }}
                  />
                )}
                {STATUS_LABEL[t.status]}
              </span>
              <span className="trigger-time">{formatTime(t.fired_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
