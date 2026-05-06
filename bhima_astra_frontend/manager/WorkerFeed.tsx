import React, { useRef, useEffect } from "react";

export type FeedAction =
  | "claim_created"
  | "claim_flagged"
  | "claim_approved"
  | "payout_completed"
  | "payout_held"
  | "worker_online"
  | "worker_offline";

export interface FeedEvent {
  id: string;
  worker_id: number;
  worker_name: string;
  action: FeedAction;
  zone_id: string;
  timestamp: string; // ISO string
  amount?: number;
}

interface WorkerFeedProps {
  events: FeedEvent[];
}

const ACTION_META: Record<FeedAction, { label: string; className: string }> = {
  claim_created: { label: "Claim Created", className: "feed-action--sys" },
  claim_flagged: { label: "Claim Flagged", className: "feed-action--fraud" },
  claim_approved: {
    label: "Claim Approved",
    className: "feed-action--decision",
  },
  payout_completed: { label: "Payout Completed", className: "feed-action--ok" },
  payout_held: { label: "Payout Held", className: "feed-action--warn" },
  worker_online: { label: "Worker Online", className: "feed-action--sys" },
  worker_offline: { label: "Worker Offline", className: "feed-action--dim" },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--:--";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const WorkerFeed: React.FC<WorkerFeedProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to latest */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="nuvia-card worker-feed-card">
      <div className="card-eyebrow">Worker Activity Feed</div>

      <div className="worker-feed-list" ref={scrollRef}>
        {events.length === 0 && (
          <div className="worker-feed-empty">No activity yet</div>
        )}

        {events.map((ev) => {
          const meta = ACTION_META[ev.action];
          return (
            <div key={ev.id} className="worker-feed-row">
              {/* Avatar */}
              <div className="worker-feed-avatar">
                {initials(ev.worker_name)}
              </div>

              {/* Content */}
              <div className="worker-feed-content">
                <div className="worker-feed-top">
                  <span className="worker-feed-name">{ev.worker_name}</span>
                  <span className="worker-feed-id">#{ev.worker_id}</span>
                  <span className={`worker-feed-action ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="worker-feed-bottom">
                  <span className="worker-feed-zone">{ev.zone_id}</span>
                  {ev.amount !== undefined && (
                    <span className="worker-feed-amount">
                      ₹{ev.amount.toLocaleString("en-IN")}
                    </span>
                  )}
                  <span className="worker-feed-ts">
                    {formatTime(ev.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Blinking cursor — indicates live feed */}
        <div className="worker-feed-cursor-row">
          <span className="cursor-blink" />
        </div>
      </div>
    </div>
  );
};
