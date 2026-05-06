/* ══════════════════════════════════════════════════════════
   BHIMA ASTRA — Static Data Constants
   Workers, Events, Reason Labels
   ══════════════════════════════════════════════════════════ */

import type { Worker, DisruptionEvent } from "./types";

// ── Real workers from DB (fraud-flagged + clean, fetched at startup) ──────────
// These replace the previous static mock data.
// Source: policy_claims JOIN workers WHERE fraud data available
// Updated: fetched from /api/v1/admin/workers/simulation on mount
export const WORKERS: Worker[] = [
  // ── Fraud-flagged workers (high risk, GPS anomalies) ──────────────────────
  {
    idx: 0,
    id: "W-0295",
    name: "Seema Chawla",
    initials: "SC",
    platform: "FreshToHome Express",
    city: "Mumbai",
    zone: "Andheri-W",
    vehicle: "Scooter",
    employment: "Full-time",
    kyc: true,
    bank: true,
    fraud_risk: 0.235,
    status: "flagged",
    tags: [
      { label: "Scooter Delivery", cls: "" },
      { label: "Full-time", cls: "" },
      { label: "KYC: Verified", cls: "" },
      { label: "Risk: 0.2350", cls: "warn" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 532.7,
      accelerometer_variance: 69.146,
      claim_response_time_sec: 74.9,
      app_interaction_count: 18,
      device_flagged: 1,
      location_jump_flag: 0,
    },
    graph: { cluster_size: 9, fraud_cluster_score: 0.9, tabular_prob: 0.99 },
  },
  {
    idx: 1,
    id: "W-0224",
    name: "Anbazhagan Subramaniam",
    initials: "AS",
    platform: "FreshToHome Express",
    city: "Jaipur",
    zone: "Raja Park",
    vehicle: "Scooter",
    employment: "Full-time",
    kyc: false,
    bank: true,
    fraud_risk: 0.4327,
    status: "flagged",
    tags: [
      { label: "Scooter Delivery", cls: "" },
      { label: "Full-time", cls: "" },
      { label: "KYC: Unverified", cls: "warn" },
      { label: "Risk: 0.4327", cls: "warn" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 665.8,
      accelerometer_variance: 2.64,
      claim_response_time_sec: 1143.2,
      app_interaction_count: 38,
      device_flagged: 1,
      location_jump_flag: 1,
    },
    graph: { cluster_size: 9, fraud_cluster_score: 0.9, tabular_prob: 0.99 },
  },
  {
    idx: 2,
    id: "W-0210",
    name: "Nitin Hegde",
    initials: "NH",
    platform: "Blinkit",
    city: "Mumbai",
    zone: "Kurla",
    vehicle: "Scooter",
    employment: "Part-time",
    kyc: true,
    bank: true,
    fraud_risk: 0.1746,
    status: "flagged",
    tags: [
      { label: "Scooter Delivery", cls: "" },
      { label: "Part-time", cls: "" },
      { label: "KYC: Verified", cls: "" },
      { label: "Risk: 0.1746", cls: "" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 593.3,
      accelerometer_variance: 27.432,
      claim_response_time_sec: 781.9,
      app_interaction_count: 15,
      device_flagged: 1,
      location_jump_flag: 0,
    },
    graph: { cluster_size: 9, fraud_cluster_score: 0.88, tabular_prob: 0.9856 },
  },
  {
    idx: 3,
    id: "W-0011",
    name: "Kavitha Dubey",
    initials: "KD",
    platform: "Blinkit",
    city: "Jaipur",
    zone: "Vaishali Nagar",
    vehicle: "Scooter",
    employment: "Full-time",
    kyc: true,
    bank: true,
    fraud_risk: 0.094,
    status: "flagged",
    tags: [
      { label: "Scooter Delivery", cls: "" },
      { label: "Full-time", cls: "" },
      { label: "KYC: Verified", cls: "" },
      { label: "Risk: 0.0940", cls: "" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 1062.9,
      accelerometer_variance: 26.984,
      claim_response_time_sec: 389.5,
      app_interaction_count: 9,
      device_flagged: 1,
      location_jump_flag: 1,
    },
    graph: { cluster_size: 9, fraud_cluster_score: 0.86, tabular_prob: 0.9562 },
  },
  // ── Clean workers (low risk, normal sensor readings) ─────────────────────
  {
    idx: 4,
    id: "W-0079",
    name: "Kavitha Mishra",
    initials: "KM",
    platform: "Swiggy Instamart",
    city: "Delhi",
    zone: "Lajpat Nagar",
    vehicle: "Bike",
    employment: "Full-time",
    kyc: false,
    bank: false,
    fraud_risk: 0.2996,
    status: "pending",
    tags: [
      { label: "Bike Delivery", cls: "" },
      { label: "Full-time", cls: "" },
      { label: "KYC: Unverified", cls: "warn" },
      { label: "Risk: 0.2996", cls: "" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 7.2,
      accelerometer_variance: 25.718,
      claim_response_time_sec: 54.7,
      app_interaction_count: 44,
      device_flagged: 0,
      location_jump_flag: 0,
    },
    graph: { cluster_size: 1, fraud_cluster_score: 0.011, tabular_prob: 0.01 },
  },
  {
    idx: 5,
    id: "W-0076",
    name: "Praveen Bose",
    initials: "PB",
    platform: "Swiggy Instamart",
    city: "Pune",
    zone: "Baner",
    vehicle: "Bike",
    employment: "Part-time",
    kyc: true,
    bank: true,
    fraud_risk: 0.2192,
    status: "verified",
    tags: [
      { label: "Bike Delivery", cls: "" },
      { label: "Part-time", cls: "" },
      { label: "KYC: Verified", cls: "" },
      { label: "Risk: 0.2192", cls: "" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 55.7,
      accelerometer_variance: 26.262,
      claim_response_time_sec: 742.4,
      app_interaction_count: 13,
      device_flagged: 0,
      location_jump_flag: 0,
    },
    graph: { cluster_size: 1, fraud_cluster_score: 0.011, tabular_prob: 0.01 },
  },
  {
    idx: 6,
    id: "W-0082",
    name: "Sanjay Patil",
    initials: "SP",
    platform: "Swiggy Instamart",
    city: "Mumbai",
    zone: "Borivali-N",
    vehicle: "Bike",
    employment: "Full-time",
    kyc: true,
    bank: true,
    fraud_risk: 0.2566,
    status: "verified",
    tags: [
      { label: "Bike Delivery", cls: "" },
      { label: "Full-time", cls: "" },
      { label: "KYC: Verified", cls: "" },
      { label: "Risk: 0.2566", cls: "" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 36.0,
      accelerometer_variance: 59.154,
      claim_response_time_sec: 274.0,
      app_interaction_count: 54,
      device_flagged: 0,
      location_jump_flag: 0,
    },
    graph: { cluster_size: 1, fraud_cluster_score: 0.011, tabular_prob: 0.01 },
  },
  {
    idx: 7,
    id: "W-0368",
    name: "Shweta Naidu",
    initials: "SN",
    platform: "Swiggy Instamart",
    city: "Bengaluru",
    zone: "HSR Layout",
    vehicle: "Scooter",
    employment: "Full-time",
    kyc: true,
    bank: true,
    fraud_risk: 0.2249,
    status: "flagged",
    tags: [
      { label: "Scooter Delivery", cls: "" },
      { label: "Full-time", cls: "" },
      { label: "KYC: Verified", cls: "" },
      { label: "Risk: 0.2249", cls: "warn" },
    ],
    synthetic: false,
    features: {
      gps_tower_delta: 152.0,
      accelerometer_variance: 57.114,
      claim_response_time_sec: 763.3,
      app_interaction_count: 50,
      device_flagged: 0,
      location_jump_flag: 0,
    },
    graph: { cluster_size: 3, fraud_cluster_score: 0.4, tabular_prob: 0.9379 },
  },
];

// ── Dynamic worker loader — fetches fresh data from backend and patches WORKERS ─
// Call this once at app init. If the API is unavailable, WORKERS retains the
// real-DB seed values defined above.
const BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_BASE_URL) ||
  "";

export async function refreshWorkersFromAPI(): Promise<void> {
  try {
    const token = localStorage.getItem("bhima_admin_token") || "";
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const res = await fetch(`${BASE_URL}/api/v1/admin/workers/simulation`, {
      headers,
    });
    if (!res.ok) return;
    const fresh: Worker[] = await res.json();
    if (Array.isArray(fresh) && fresh.length > 0) {
      // Mutate in place so existing references stay valid
      WORKERS.length = 0;
      fresh.forEach((w, i) => WORKERS.push({ ...w, idx: i }));
    }
  } catch {
    // silent – keep seed data
  }
}

export const EVENTS: DisruptionEvent[] = [
  {
    id: "EVT-C001",
    day: 1,
    hour: 14,
    rainfall: 1.6,
    aqi: 338,
    traffic: 86.6,
    composite: 0.4935,
    label: "High AQI — Moderate disruption",
    trigger: "aqi",
    flood_alert: 0,
    road_closure: 0,
  },
  {
    id: "EVT-C004",
    day: 4,
    hour: 15,
    rainfall: 7.2,
    aqi: 465,
    traffic: 56.9,
    composite: 0.5465,
    label: "Critical AQI event + light rain",
    trigger: "aqi,rainfall",
    flood_alert: 0,
    road_closure: 0,
  },
  {
    id: "EVT-C112",
    day: 3,
    hour: 9,
    rainfall: 52.3,
    aqi: 280,
    traffic: 92.4,
    composite: 0.781,
    label: "Heavy rainfall + traffic surge",
    trigger: "rainfall,traffic",
    flood_alert: 1,
    road_closure: 1,
  },
  {
    id: "EVT-C003",
    day: 3,
    hour: 9,
    rainfall: 0.3,
    aqi: 457,
    traffic: 64.6,
    composite: 0.4895,
    label: "Severe AQI — Work disruption",
    trigger: "aqi",
    flood_alert: 0,
    road_closure: 0,
  },
  {
    id: "EVT-C201",
    day: 2,
    hour: 11,
    rainfall: 12.1,
    aqi: 180,
    traffic: 76.2,
    composite: 0.46,
    label: "Moderate traffic + rain",
    trigger: "traffic",
    flood_alert: 0,
    road_closure: 0,
  },
  {
    id: "EVT-CRIT",
    day: 5,
    hour: 16,
    rainfall: 68.4,
    aqi: 490,
    traffic: 98.1,
    composite: 0.924,
    label: "CRITICAL — All sensors exceeded",
    trigger: "rainfall,aqi,traffic",
    flood_alert: 1,
    road_closure: 1,
  },
];

export const REASON_LABELS: Record<string, string> = {
  normal: "Clean Signal Detected",
  gps_mismatch: "GPS / Cell Tower Mismatch",
  device_anomaly: "Device Behavioral Anomaly",
  abnormal_behavior: "Abnormal Filing Speed",
  ring_cluster: "Fraud Ring Cluster Detected",
  behavioral_anomaly: "LSTM Behavioral Anomaly",
  rule_triggered: "Deterministic Rule Triggered",
  high_tabular_prob: "High XGBoost Fraud Probability",
  multi_factor: "Multi-Factor Risk Signal",
};

export const REASON_SUBS: Record<string, string> = {
  normal: "All pipeline stages returned clean scores. Payout approved.",
  gps_mismatch: "GPS coordinates do not match cell tower triangulation.",
  device_anomaly: "Accelerometer signature indicates stationary GPS spoofing.",
  abnormal_behavior: "Claim filed in under 60 seconds — possible bot activity.",
  ring_cluster: "Worker connected to a multi-node fraud cluster.",
  behavioral_anomaly: "LSTM behavior score exceeds anomaly threshold of 0.70.",
  rule_triggered: "Deterministic rule engine flagged this claim for review.",
  high_tabular_prob: "XGBoost model assigned high fraud probability.",
  multi_factor: "Multiple weak signals converge above decision threshold.",
};
