import type { Zone } from "../../components/manager/ZoneOverview";
import type { FeedEvent } from "../../components/manager/WorkerFeed";
import type { TriggerEvent } from "../../components/manager/TriggerPanel";
import type { DailyStats } from "../../components/manager/ManagerStats";
import { getManagerToken } from "./src/services/managerApi";

export const MOCK_ZONES: Zone[] = [
  {
    zone_id: "MUM-WEST-01",
    zone_name: "Mumbai West",
    status: "alert",
    active_workers: 67,
    disruption_level: "high",
    composite_score: 0.78,
    pending_flags: 3,
    active_payouts: 12,
  },
  {
    zone_id: "MUM-EAST-02",
    zone_name: "Mumbai East",
    status: "active",
    active_workers: 54,
    disruption_level: "medium",
    composite_score: 0.52,
    pending_flags: 1,
    active_payouts: 4,
  },
  {
    zone_id: "MUM-CNTRL-03",
    zone_name: "Mumbai Central",
    status: "stable",
    active_workers: 89,
    disruption_level: "low",
    composite_score: 0.28,
    pending_flags: 0,
    active_payouts: 0,
  },
  {
    zone_id: "MUM-SOUTH-04",
    zone_name: "Mumbai South",
    status: "stable",
    active_workers: 42,
    disruption_level: "none",
    composite_score: 0.14,
    pending_flags: 0,
    active_payouts: 0,
  },
];

const now = new Date();
const ts = (offsetSec: number) =>
  new Date(now.getTime() - offsetSec * 1000).toISOString();

export const MOCK_FEED: FeedEvent[] = [
  {
    id: "f1",
    worker_id: 1024,
    worker_name: "Vishnu Kumar",
    action: "claim_created",
    zone_id: "MUM-WEST-01",
    timestamp: ts(840),
  },
  {
    id: "f2",
    worker_id: 1031,
    worker_name: "Arjun Mehta",
    action: "payout_completed",
    zone_id: "MUM-WEST-01",
    timestamp: ts(610),
    amount: 720,
  },
  {
    id: "f3",
    worker_id: 1019,
    worker_name: "Priya Sharma",
    action: "claim_flagged",
    zone_id: "MUM-EAST-02",
    timestamp: ts(480),
  },
  {
    id: "f4",
    worker_id: 1055,
    worker_name: "Ravi Nair",
    action: "claim_approved",
    zone_id: "MUM-WEST-01",
    timestamp: ts(300),
    amount: 480,
  },
  {
    id: "f5",
    worker_id: 1062,
    worker_name: "Sneha Pillai",
    action: "worker_online",
    zone_id: "MUM-CNTRL-03",
    timestamp: ts(220),
  },
  {
    id: "f6",
    worker_id: 1044,
    worker_name: "Deepak Yadav",
    action: "payout_held",
    zone_id: "MUM-WEST-01",
    timestamp: ts(90),
    amount: 960,
  },
  {
    id: "f7",
    worker_id: 1078,
    worker_name: "Anita Reddy",
    action: "claim_created",
    zone_id: "MUM-WEST-01",
    timestamp: ts(30),
  },
];

export const MOCK_TRIGGERS: TriggerEvent[] = [
  {
    trigger_id: "t1",
    trigger_type: "rainfall",
    trigger_level: "L2",
    trigger_value: 128.4,
    zone_id: "MUM-WEST-01",
    status: "active",
    workers_affected: 67,
    fired_at: ts(720),
  },
  {
    trigger_id: "t2",
    trigger_type: "aqi",
    trigger_level: "L1",
    trigger_value: 312,
    zone_id: "MUM-EAST-02",
    status: "monitoring",
    workers_affected: 54,
    fired_at: ts(1800),
  },
  {
    trigger_id: "t3",
    trigger_type: "heat",
    trigger_level: "L1",
    trigger_value: 41.2,
    zone_id: "MUM-SOUTH-04",
    status: "resolved",
    workers_affected: 42,
    fired_at: ts(14400),
    resolved_at: ts(3600),
  },
  {
    trigger_id: "t4",
    trigger_type: "curfew",
    trigger_level: "L2",
    trigger_value: 1,
    zone_id: "MUM-WEST-01",
    status: "active",
    workers_affected: 58,
    fired_at: ts(1200),
  },
];

export const MOCK_STATS: DailyStats = {
  total_claims_today: 134,
  approved_payouts: 119,
  flagged_cases: 12,
  avg_processing_time_sec: 87,
  new_registrations: 8,
  offline_workers: 23,
};

// ── API Fetch Functions with Fallback ────────────────────────────────────────

const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || "http://localhost:8000";

const getHeaders = () => ({
  "Content-Type": "application/json",
  ...(getManagerToken() && { Authorization: `Bearer ${getManagerToken()}` }),
});

/**
 * Fetch zones data from API with fallback to MOCK_ZONES
 */
export const fetchZones = async (): Promise<Zone[]> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/zones`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : MOCK_ZONES;
  } catch (err) {
    console.warn(
      "Failed to fetch zones data, using fallback:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return MOCK_ZONES;
  }
};

/**
 * Fetch worker feed events from API with fallback to MOCK_FEED
 */
export const fetchWorkerFeed = async (): Promise<FeedEvent[]> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/manager/feed?limit=7`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : MOCK_FEED;
  } catch (err) {
    console.warn(
      "Failed to fetch worker feed, using fallback:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return MOCK_FEED;
  }
};

/**
 * Fetch active triggers from API with fallback to MOCK_TRIGGERS
 */
export const fetchTriggers = async (): Promise<TriggerEvent[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/manager/triggers?limit=4`,
      {
        method: "GET",
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : MOCK_TRIGGERS;
  } catch (err) {
    console.warn(
      "Failed to fetch triggers, using fallback:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return MOCK_TRIGGERS;
  }
};

/**
 * Fetch daily statistics from API with fallback to MOCK_STATS
 */
export const fetchDailyStats = async (): Promise<DailyStats> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/manager/stats`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      total_claims_today:
        data.total_claims_today ?? MOCK_STATS.total_claims_today,
      approved_payouts: data.approved_payouts ?? MOCK_STATS.approved_payouts,
      flagged_cases: data.flagged_cases ?? MOCK_STATS.flagged_cases,
      avg_processing_time_sec:
        data.avg_processing_time_sec ?? MOCK_STATS.avg_processing_time_sec,
      new_registrations: data.new_registrations ?? MOCK_STATS.new_registrations,
      offline_workers: data.offline_workers ?? MOCK_STATS.offline_workers,
    };
  } catch (err) {
    console.warn(
      "Failed to fetch daily stats, using fallback:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return MOCK_STATS;
  }
};

/**
 * Fetch all dashboard data in parallel with fallbacks
 */
export const fetchManagerDashboardData = async () => {
  const [zones, feed, triggers, stats] = await Promise.all([
    fetchZones(),
    fetchWorkerFeed(),
    fetchTriggers(),
    fetchDailyStats(),
  ]);

  return {
    zones,
    feed,
    triggers,
    stats,
  };
};
