// Manager Mock Data API Service with Fallback
// Fetches real data from API, falls back to mock values on errors

import { getManagerToken } from './managerApi';
import type { Zone } from '../../components/manager/ZoneOverview';
import type { FeedEvent } from '../../components/manager/WorkerFeed';
import type { TriggerEvent } from '../../components/manager/TriggerPanel';
import type { DailyStats } from '../../components/manager/ManagerStats';

const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || 'http://localhost:8000';

// ── Helper: Build auth headers ────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getManagerToken() && { Authorization: `Bearer ${getManagerToken()}` }),
});

// ── Fallback Mock Data ────────────────────────────────────────────────────

const now = new Date();
const ts = (offsetSec: number) =>
  new Date(now.getTime() - offsetSec * 1000).toISOString();

const FALLBACK_ZONES: Zone[] = [
  {
    zone_id: 'MUM-WEST-01',
    zone_name: 'Mumbai West',
    status: 'alert',
    active_workers: 67,
    disruption_level: 'high',
    composite_score: 0.78,
    pending_flags: 3,
    active_payouts: 12,
  },
  {
    zone_id: 'MUM-EAST-02',
    zone_name: 'Mumbai East',
    status: 'active',
    active_workers: 54,
    disruption_level: 'medium',
    composite_score: 0.52,
    pending_flags: 1,
    active_payouts: 4,
  },
  {
    zone_id: 'MUM-CNTRL-03',
    zone_name: 'Mumbai Central',
    status: 'stable',
    active_workers: 89,
    disruption_level: 'low',
    composite_score: 0.28,
    pending_flags: 0,
    active_payouts: 0,
  },
  {
    zone_id: 'MUM-SOUTH-04',
    zone_name: 'Mumbai South',
    status: 'stable',
    active_workers: 42,
    disruption_level: 'none',
    composite_score: 0.14,
    pending_flags: 0,
    active_payouts: 0,
  },
];

const FALLBACK_FEED: FeedEvent[] = [
  {
    id: 'f1',
    worker_id: 1024,
    worker_name: 'Vishnu Kumar',
    action: 'claim_created',
    zone_id: 'MUM-WEST-01',
    timestamp: ts(840),
  },
  {
    id: 'f2',
    worker_id: 1031,
    worker_name: 'Arjun Mehta',
    action: 'payout_completed',
    zone_id: 'MUM-WEST-01',
    timestamp: ts(610),
    amount: 720,
  },
  {
    id: 'f3',
    worker_id: 1019,
    worker_name: 'Priya Sharma',
    action: 'claim_flagged',
    zone_id: 'MUM-EAST-02',
    timestamp: ts(480),
  },
  {
    id: 'f4',
    worker_id: 1055,
    worker_name: 'Ravi Nair',
    action: 'claim_approved',
    zone_id: 'MUM-WEST-01',
    timestamp: ts(300),
    amount: 480,
  },
  {
    id: 'f5',
    worker_id: 1062,
    worker_name: 'Sneha Pillai',
    action: 'worker_online',
    zone_id: 'MUM-CNTRL-03',
    timestamp: ts(220),
  },
  {
    id: 'f6',
    worker_id: 1044,
    worker_name: 'Deepak Yadav',
    action: 'payout_held',
    zone_id: 'MUM-WEST-01',
    timestamp: ts(90),
    amount: 960,
  },
  {
    id: 'f7',
    worker_id: 1078,
    worker_name: 'Anita Reddy',
    action: 'claim_created',
    zone_id: 'MUM-WEST-01',
    timestamp: ts(30),
  },
];

const FALLBACK_TRIGGERS: TriggerEvent[] = [
  {
    claim_id: 1,
    zone_id: 'MUM-WEST-01',
    trigger_type: 'rainfall',
    trigger_level: 'L2',
    trigger_value: 128.4,
    workers_affected: 67,
    total_payout: 134000,
    fraud_holds: 2,
    fired_at: ts(720),
    payout_status: 'active',
  },
  {
    claim_id: 2,
    zone_id: 'MUM-EAST-02',
    trigger_type: 'aqi',
    trigger_level: 'L1',
    trigger_value: 312,
    workers_affected: 54,
    total_payout: 54000,
    fraud_holds: 1,
    fired_at: ts(1800),
    payout_status: 'monitoring',
  },
  {
    claim_id: 3,
    zone_id: 'MUM-SOUTH-04',
    trigger_type: 'heat',
    trigger_level: 'L1',
    trigger_value: 41.2,
    workers_affected: 42,
    total_payout: 42000,
    fraud_holds: 0,
    fired_at: ts(14400),
    payout_status: 'resolved',
  },
  {
    claim_id: 4,
    zone_id: 'MUM-WEST-01',
    trigger_type: 'curfew',
    trigger_level: 'L2',
    trigger_value: 1,
    workers_affected: 58,
    total_payout: 116000,
    fraud_holds: 3,
    fired_at: ts(1200),
    payout_status: 'active',
  },
];

const FALLBACK_STATS: DailyStats = {
  total_claims_today: 134,
  approved_payouts: 119,
  flagged_cases: 12,
  avg_processing_time_sec: 87,
  new_registrations: 8,
  offline_workers: 23,
};

// ── Public API Functions ──────────────────────────────────────────────────

/**
 * Fetch zones data (zone overview)
 * Falls back to mock data on API failure
 */
export const fetchZones = async (): Promise<Zone[]> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/zones`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_ZONES;
  } catch (err) {
    console.warn(
      'Failed to fetch zones data, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_ZONES;
  }
};

/**
 * Fetch worker feed events
 * Falls back to mock data on API failure
 */
export const fetchWorkerFeed = async (): Promise<FeedEvent[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/manager/feed?limit=7`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_FEED;
  } catch (err) {
    console.warn(
      'Failed to fetch worker feed, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_FEED;
  }
};

/**
 * Fetch active triggers for zones
 * Falls back to mock data on API failure
 */
export const fetchTriggers = async (): Promise<TriggerEvent[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/manager/triggers?limit=4`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_TRIGGERS;
  } catch (err) {
    console.warn(
      'Failed to fetch triggers, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_TRIGGERS;
  }
};

/**
 * Fetch daily statistics
 * Falls back to mock data on API failure
 */
export const fetchDailyStats = async (): Promise<DailyStats> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/manager/stats`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      total_claims_today: data.total_claims_today ?? FALLBACK_STATS.total_claims_today,
      approved_payouts: data.approved_payouts ?? FALLBACK_STATS.approved_payouts,
      flagged_cases: data.flagged_cases ?? FALLBACK_STATS.flagged_cases,
      avg_processing_time_sec: data.avg_processing_time_sec ?? FALLBACK_STATS.avg_processing_time_sec,
      new_registrations: data.new_registrations ?? FALLBACK_STATS.new_registrations,
      offline_workers: data.offline_workers ?? FALLBACK_STATS.offline_workers,
    };
  } catch (err) {
    console.warn(
      'Failed to fetch daily stats, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_STATS;
  }
};

/**
 * Fetch multiple data sources in parallel
 * Returns fallback data for any failed requests
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
