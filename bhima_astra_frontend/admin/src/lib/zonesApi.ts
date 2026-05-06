// Zones API Service with Fallback
// Fetches real zones data from API, falls back to mock values on errors

import { getAdminToken } from './adminApi';

const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || '';

// ── Helper: Build auth headers ────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getAdminToken() && { Authorization: `Bearer ${getAdminToken()}` }),
});

// ── Types ─────────────────────────────────────────────────────────────────

export interface Zone {
  zone_id: string;
  zone_name: string;
  state: string;
  city: string;
  region: string;
  status: 'active' | 'alert' | 'stable';
  risk_level: 'low' | 'medium' | 'high';
  active_workers: number;
  total_workers: number;
  composite_score: number;
  disruption_probability: number;
  disruption_events: number;
  manager_flags: number;
  recent_trigger_count: number;
  avg_payout_amount: number;
  fraud_rate: number;
  weather_condition?: string;
  aqi_level?: string;
}

export interface ZoneDetail extends Zone {
  created_at: string;
  updated_at: string;
  manager_id: number | null;
  active_policies: number;
  total_claims_this_week: number;
  payouts_this_week: number;
  fraud_holds_this_week: number;
}

export interface ZoneStats {
  total_zones: number;
  active_zones: number;
  alert_zones: number;
  stable_zones: number;
  avg_workers_per_zone: number;
  avg_composite_score: number;
  total_active_workers: number;
}

// ── Fallback Mock Data ────────────────────────────────────────────────────

export const FALLBACK_ZONES: Zone[] = [
  {
    zone_id: 'MUM-WEST-01',
    zone_name: 'Mumbai West',
    state: 'Maharashtra',
    city: 'Mumbai',
    region: 'Western Suburbs',
    status: 'alert',
    risk_level: 'high',
    active_workers: 67,
    total_workers: 120,
    composite_score: 0.78,
    disruption_probability: 0.65,
    disruption_events: 3,
    manager_flags: 2,
    recent_trigger_count: 4,
    avg_payout_amount: 650,
    fraud_rate: 0.08,
    weather_condition: 'Heavy Rain',
    aqi_level: 'Unhealthy (168)',
  },
  {
    zone_id: 'MUM-EAST-02',
    zone_name: 'Mumbai East',
    state: 'Maharashtra',
    city: 'Mumbai',
    region: 'Eastern Suburbs',
    status: 'active',
    risk_level: 'medium',
    active_workers: 54,
    total_workers: 95,
    composite_score: 0.52,
    disruption_probability: 0.4,
    disruption_events: 1,
    manager_flags: 1,
    recent_trigger_count: 2,
    avg_payout_amount: 520,
    fraud_rate: 0.05,
    weather_condition: 'Partly Cloudy',
    aqi_level: 'Moderate (92)',
  },
  {
    zone_id: 'MUM-CNTRL-03',
    zone_name: 'Mumbai Central',
    state: 'Maharashtra',
    city: 'Mumbai',
    region: 'Central',
    status: 'stable',
    risk_level: 'low',
    active_workers: 89,
    total_workers: 150,
    composite_score: 0.28,
    disruption_probability: 0.15,
    disruption_events: 0,
    manager_flags: 0,
    recent_trigger_count: 1,
    avg_payout_amount: 450,
    fraud_rate: 0.02,
    weather_condition: 'Clear',
    aqi_level: 'Good (48)',
  },
  {
    zone_id: 'MUM-SOUTH-04',
    zone_name: 'Mumbai South',
    state: 'Maharashtra',
    city: 'Mumbai',
    region: 'Southern',
    status: 'stable',
    risk_level: 'low',
    active_workers: 42,
    total_workers: 75,
    composite_score: 0.14,
    disruption_probability: 0.08,
    disruption_events: 0,
    manager_flags: 0,
    recent_trigger_count: 0,
    avg_payout_amount: 380,
    fraud_rate: 0.01,
    weather_condition: 'Sunny',
    aqi_level: 'Good (35)',
  },
  {
    zone_id: 'DEL-NORTH-05',
    zone_name: 'Delhi North',
    state: 'Delhi',
    city: 'New Delhi',
    region: 'Northern',
    status: 'alert',
    risk_level: 'high',
    active_workers: 78,
    total_workers: 130,
    composite_score: 0.72,
    disruption_probability: 0.58,
    disruption_events: 2,
    manager_flags: 1,
    recent_trigger_count: 3,
    avg_payout_amount: 680,
    fraud_rate: 0.07,
    weather_condition: 'Haze',
    aqi_level: 'Very Unhealthy (215)',
  },
];

export const FALLBACK_ZONE_STATS: ZoneStats = {
  total_zones: 5,
  active_zones: 2,
  alert_zones: 2,
  stable_zones: 1,
  avg_workers_per_zone: 66,
  avg_composite_score: 0.49,
  total_active_workers: 330,
};

// ── Public API Functions ──────────────────────────────────────────────────

/**
 * Fetch all zones from API with fallback to mock data
 */
export const fetchAllZones = async (): Promise<Zone[]> => {
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
      'Failed to fetch zones, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_ZONES;
  }
};

/**
 * Fetch detailed information for a specific zone
 */
export const fetchZoneDetail = async (zoneId: string): Promise<ZoneDetail | null> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/zones/${encodeURIComponent(zoneId)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as ZoneDetail;
  } catch (err) {
    console.warn(
      `Failed to fetch zone detail for ${zoneId}, using fallback:`,
      err instanceof Error ? err.message : 'Unknown error',
    );

    // Return fallback zone detail constructed from fallback zones
    const fallbackZone = FALLBACK_ZONES.find((z) => z.zone_id === zoneId);
    if (fallbackZone) {
      return {
        ...fallbackZone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        manager_id: null,
        active_policies: 42,
        total_claims_this_week: 28,
        payouts_this_week: 24,
        fraud_holds_this_week: 2,
      };
    }
    return null;
  }
};

/**
 * Fetch zones statistics
 */
export const fetchZonesStats = async (): Promise<ZoneStats> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/zones/stats`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      total_zones: data.total_zones ?? FALLBACK_ZONE_STATS.total_zones,
      active_zones: data.active_zones ?? FALLBACK_ZONE_STATS.active_zones,
      alert_zones: data.alert_zones ?? FALLBACK_ZONE_STATS.alert_zones,
      stable_zones: data.stable_zones ?? FALLBACK_ZONE_STATS.stable_zones,
      avg_workers_per_zone: data.avg_workers_per_zone ?? FALLBACK_ZONE_STATS.avg_workers_per_zone,
      avg_composite_score: data.avg_composite_score ?? FALLBACK_ZONE_STATS.avg_composite_score,
      total_active_workers: data.total_active_workers ?? FALLBACK_ZONE_STATS.total_active_workers,
    };
  } catch (err) {
    console.warn(
      'Failed to fetch zones stats, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_ZONE_STATS;
  }
};

/**
 * Fetch zones filtered by status
 */
export const fetchZonesByStatus = async (
  status: 'active' | 'alert' | 'stable',
): Promise<Zone[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/zones?status=${encodeURIComponent(status)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data
      : FALLBACK_ZONES.filter((z) => z.status === status);
  } catch (err) {
    console.warn(
      `Failed to fetch zones with status ${status}, using fallback:`,
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_ZONES.filter((z) => z.status === status);
  }
};

/**
 * Fetch zones filtered by risk level
 */
export const fetchZonesByRiskLevel = async (
  riskLevel: 'low' | 'medium' | 'high',
): Promise<Zone[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/zones?risk_level=${encodeURIComponent(riskLevel)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data
      : FALLBACK_ZONES.filter((z) => z.risk_level === riskLevel);
  } catch (err) {
    console.warn(
      `Failed to fetch zones with risk level ${riskLevel}, using fallback:`,
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_ZONES.filter((z) => z.risk_level === riskLevel);
  }
};

/**
 * Fetch zones for a specific state/city
 */
export const fetchZonesByLocation = async (
  city: string,
): Promise<Zone[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/zones?city=${encodeURIComponent(city)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data
      : FALLBACK_ZONES.filter((z) => z.city === city);
  } catch (err) {
    console.warn(
      `Failed to fetch zones for city ${city}, using fallback:`,
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_ZONES.filter((z) => z.city === city);
  }
};

/**
 * Fetch all zones data with stats in parallel
 */
export const fetchZonesPageData = async () => {
  const [zones, stats] = await Promise.all([
    fetchAllZones(),
    fetchZonesStats(),
  ]);

  return {
    zones,
    stats,
  };
};
