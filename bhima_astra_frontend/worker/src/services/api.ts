// ── Central API client for BHIMA ASTRA Worker Portal ─────────────────────────
// Base URL reads from VITE_API_BASE_URL env var; defaults to localhost:8000
// JWT token stored in localStorage under key 'bhima_worker_token'

const BASE_URL =
  ((import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL as string) || "http://localhost:8000";

// ── Auth helpers ──────────────────────────────────────────────────────────────
export const getToken = (): string =>
  localStorage.getItem("bhima_worker_token") || "";

export const setToken = (token: string): void => {
  localStorage.setItem("bhima_worker_token", token);
};

export const clearToken = (): void => {
  localStorage.removeItem("bhima_worker_token");
  localStorage.removeItem("bhima_worker_id");
  localStorage.removeItem("isLoggedIn");
};

const authHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore JSON parse error, use HTTP status text
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Response Types ────────────────────────────────────────────────────────────

export interface OtpSendResponse {
  message: string;
  demo_otp?: string | null;
}

export interface OtpVerifyResponse {
  access_token: string;
  token_type: string;
  worker_id: number;
}

export interface WorkerProfile {
  worker_id: number;
  worker_name: string | null;
  platform: string | null;
  city: string | null;
  geo_zone_id: string | null;
  vehicle_type: string | null;
  shift_hours: number | null;
  experience_level: number | null;
  employment_type: string | null;
  upi_id: string | null;
  bank_ifsc: string | null;
  kyc_verified: boolean | null;
  bank_verified: boolean | null;
  fraud_risk_score: number | null;
  payment_verified_status: string | null;
  phone_number: string | null;
}

export interface PayoutItem {
  claim_id: number;
  worker_id: number | null;
  plan_tier: string | null;
  trigger_type: string | null;
  trigger_level: string | null;
  trigger_value: number | null;
  payout_status: string | null;
  payout_amount: number | null;
  fraud_score: number | null;
  fraud_flag: boolean | null;
  fraud_reason: string | null;
  income_loss: number | null;
  claim_timestamp: string | null;
  payout_timestamp: string | null;
}

export interface EarningsEstimate {
  avg_income: number;
  expected_orders: number | null;
  expected_income: number | null;
  actual_income_today: number | null;
  income_gap: number | null;
}

export interface ActivePolicy {
  claim_id?: number | null;
  plan_tier?: string | null;
  weekly_premium?: number | null;
  events_remaining?: number | null;
  events_used?: number | null;
  policy_status?: string | null;
  activation_date?: string | null;
  last_active_date?: string | null;
  policy_id?: number | null;
  payout_l1?: number | null;       // ML-computed L1 payout (stored at activation)
  payout_l2?: number | null;       // ML-computed L2 payout
  payout_l3?: number | null;       // ML-computed L3 payout
  per_event_payout?: number | null; // = payout_l1 (convenience alias)
  max_weekly_payout?: number | null; // = payout_l3 * 2
  message?: string;
}

export interface PlanTier {
  tier: string;
  weekly_premium: number;
  base_premium: number;
  city_multiplier: number;
  payout_l1: number;
  payout_l2: number;
  payout_l3: number;
  max_events: number;
}

export interface PlansCompareResponse {
  city: string;
  city_tier: number;
  tier_label: string;
  multiplier: number;
  plans: PlanTier[];
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

export interface ForecastDay {
  forecast_date: string;
  p_rain: number;
  p_heat: number;
  p_aqi: number;
  composite_risk: number;
  risk_label: string;
}

export interface ZoneForecast {
  zone_id: string;
  forecast: ForecastDay[];
  cached: boolean;
}

// ── Auth APIs ─────────────────────────────────────────────────────────────────

export const sendOtp = (phone: string): Promise<OtpSendResponse> =>
  apiRequest<OtpSendResponse>("/api/v1/auth/worker/otp-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phone }),
  });

export const verifyOtp = (
  phone: string,
  otp: string,
): Promise<OtpVerifyResponse> =>
  apiRequest<OtpVerifyResponse>("/api/v1/auth/worker/otp-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phone, otp }),
  });

// ── Worker APIs ───────────────────────────────────────────────────────────────

export const getWorkerProfile = (): Promise<WorkerProfile> =>
  apiRequest<WorkerProfile>("/workers/me/profile", {
    headers: authHeaders(),
  });

export const getWorkerPayouts = (): Promise<PayoutItem[]> =>
  apiRequest<PayoutItem[]>("/workers/me/payouts", {
    headers: authHeaders(),
  });

export const getEarningsEstimate = (): Promise<EarningsEstimate> =>
  apiRequest<EarningsEstimate>("/workers/me/earnings-estimate", {
    headers: authHeaders(),
  });

export const updateWorkerProfile = (
  workerId: number,
  data: Partial<WorkerProfile>,
): Promise<{ message: string }> =>
  apiRequest<{ message: string }>(`/workers/${workerId}/profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

// ── Policy APIs ───────────────────────────────────────────────────────────────

export const getActivePolicy = (): Promise<ActivePolicy> =>
  apiRequest<ActivePolicy>("/policies/me", {
    headers: authHeaders(),
  });

export const comparePlans = (city = "Mumbai"): Promise<PlansCompareResponse> =>
  apiRequest<PlansCompareResponse>(
    `/policies/plans/compare?city=${encodeURIComponent(city)}`,
    { headers: authHeaders() },
  );

export const activatePolicy = (
  planTier: string,
): Promise<Record<string, unknown>> =>
  apiRequest<Record<string, unknown>>("/policies/activate", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ plan_tier: planTier }),
  });

// ── Zone APIs ─────────────────────────────────────────────────────────────────

export const getZoneLive = (zoneId: string): Promise<ZoneLiveData> =>
  apiRequest<ZoneLiveData>(`/zones/${encodeURIComponent(zoneId)}/live`);

export const getZoneForecast = (zoneId: string): Promise<ZoneForecast> =>
  apiRequest<ZoneForecast>(
    `/api/v1/forecast/days?zone_id=${encodeURIComponent(zoneId)}`,
  );
