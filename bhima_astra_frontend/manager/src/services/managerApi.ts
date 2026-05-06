// Central API client for BHIMA ASTRA Manager Portal
// JWT stored in localStorage as 'bhima_manager_token'

const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || 'http://localhost:8000';

export const getManagerToken = (): string =>
  localStorage.getItem('bhima_manager_token') || '';

export const setManagerToken = (token: string) =>
  localStorage.setItem('bhima_manager_token', token);

export const clearManagerToken = () => {
  localStorage.removeItem('bhima_manager_token');
  localStorage.removeItem('bhima_manager_id');
  localStorage.removeItem('bhima_manager_name');
  localStorage.removeItem('bhima_manager_zones');
  localStorage.removeItem('managerLoggedIn');
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getManagerToken()}`,
});

async function apiReq<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ManagerLoginResponse {
  access_token: string;
  token_type: string;
  manager_id: number;
  manager_name: string;
  assigned_zones: string[];
}

export interface ManagerProfile {
  manager_id: number;
  manager_name: string | null;
  email: string | null;
  assigned_zones: string[];
  dark_store_lat?: number | null;
  dark_store_lng?: number | null;
  dark_store_address?: string | null;
}

export interface ManagerStats {
  new_registrations: number;
  payouts_processed: number;
  flags_raised: number;
  offline_workers_paid: number;
  fraud_holds: number;
  total_active_workers: number;
  total_active_policies: number;
}

export interface WorkerInZone {
  worker_id: number;
  worker_name: string | null;
  platform: string | null;
  vehicle_type: string | null;
  geo_zone_id: string | null;
  fraud_risk_score: number | null;
  kyc_verified: boolean | null;
  payment_verified_status: string | null;
  upi_id: string | null;
  policy_status: string | null;
  plan_tier: string | null;
  income_today?: number;
  orders_today?: number;
}

export interface TriggerEvent {
  claim_id: number;
  zone_id: string | null;
  trigger_type: string | null;
  trigger_level: string | null;
  trigger_value: number | null;
  workers_affected: number;
  total_payout: number;
  fraud_holds: number;
  fired_at: string | null;
  payout_status: string | null;
}

export interface DisruptionFlag {
  flag_id: number;
  manager_id: number;
  zone_id: string;
  disruption_type: string;
  description: string | null;
  evidence_url: string | null;
  estimated_start: string | null;
  estimated_end: string | null;
  flag_status: string;
  payout_enabled: boolean;
  flagged_at: string | null;
  admin_verified: boolean | null;
  verified_at: string | null;
}

export interface ZoneLiveData {
  zone_id: string;
  zone_risk_score: number;
  disruption_probability: number;
  disruption_events: number;
  manager_flags: number;
  trigger_recommended: boolean;
  worker_count: number;
}

export interface CreateFlagPayload {
  manager_id: number;
  zone_id: string;
  disruption_type: string;
  description: string;
  evidence_url?: string;
  estimated_start?: string;
  estimated_end?: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────

export const managerLogin = (
  email: string,
  password: string,
): Promise<ManagerLoginResponse> =>
  apiReq<ManagerLoginResponse>('/api/v1/auth/manager/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

// ── Manager endpoints ─────────────────────────────────────────────────────

export const getManagerProfile = (): Promise<ManagerProfile> =>
  apiReq<ManagerProfile>('/manager/me/profile', { headers: authHeaders() });

export const getManagerStats = (): Promise<ManagerStats> =>
  apiReq<ManagerStats>('/manager/me/stats', { headers: authHeaders() });

export const getManagerFlags = (): Promise<DisruptionFlag[]> =>
  apiReq<DisruptionFlag[]>('/manager/me/flags', { headers: authHeaders() });

export const getZoneWorkers = (
  zoneId: string,
  status?: string,
  fraudRisk?: string,
): Promise<WorkerInZone[]> => {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (fraudRisk && fraudRisk !== 'all') params.set('fraud_risk', fraudRisk);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiReq<WorkerInZone[]>(
    `/manager/zones/${encodeURIComponent(zoneId)}/workers${qs}`,
    { headers: authHeaders() },
  );
};

export const getZoneTriggers = (
  zoneId: string,
  limit = 10,
): Promise<TriggerEvent[]> =>
  apiReq<TriggerEvent[]>(
    `/manager/zones/${encodeURIComponent(zoneId)}/triggers?limit=${limit}`,
    { headers: authHeaders() },
  );

export const getZoneLive = (zoneId: string): Promise<ZoneLiveData> =>
  apiReq<ZoneLiveData>(
    `/zones/${encodeURIComponent(zoneId)}/live`,
    { headers: authHeaders() },
  );

export const createDisruptionFlag = (
  payload: CreateFlagPayload,
): Promise<Record<string, unknown>> =>
  apiReq<Record<string, unknown>>('/manager/flag-disruption', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
