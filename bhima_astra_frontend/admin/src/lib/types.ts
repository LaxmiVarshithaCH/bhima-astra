/* ══════════════════════════════════════════════════════════
   BHIMA ASTRA — TypeScript Type Definitions
   ══════════════════════════════════════════════════════════ */

export interface WorkerTag {
  label: string;
  cls: string;
}

export interface WorkerFeatures {
  gps_tower_delta: number;
  accelerometer_variance: number;
  claim_response_time_sec: number;
  app_interaction_count: number;
  device_flagged: number;
  location_jump_flag: number;
}

export interface WorkerGraph {
  cluster_size: number;
  fraud_cluster_score: number;
  tabular_prob: number;
}

export interface Worker {
  idx: number;
  id: string;
  name: string;
  initials: string;
  platform: string;
  city: string;
  zone: string;
  vehicle: string;
  employment: string;
  kyc: boolean;
  bank: boolean;
  fraud_risk: number;
  status: string;
  tags: WorkerTag[];
  synthetic: boolean;
  features: WorkerFeatures;
  graph: WorkerGraph;
}

export interface DisruptionEvent {
  id: string;
  day: number;
  hour: number;
  rainfall: number;
  aqi: number;
  traffic: number;
  composite: number;
  label: string;
  trigger: string;
  flood_alert: number;
  road_closure: number;
}

export interface RuleEngineResult {
  rule_score: number;
  rule_flags: string[];
  rule_decision: 'PASS' | 'REVIEW';
}

export interface BehaviorResult {
  behavior_score: number;
  gpsComp: number;
  motionComp: number;
  interactComp: number;
  locationJump: number;
}

export interface DecisionResult {
  finalScore: number;
  percentile: number;
  decision: 'APPROVE' | 'REVIEW' | 'BLOCK';
  fraudFlag: number;
  payoutStatus: 'FULL_RELEASE' | 'PARTIAL_RELEASE' | 'ON_HOLD';
  holdDuration: string | null;
  primary_reason: string;
  all_reasons: string[];
  tabularProb: number;
  clusterScore: number;
  clusterSize: number;
  behaviorScore: number;
  ruleScore: number;
}

export interface FeatureImportance {
  name: string;
  importance: number;
}

/** Fraud Agent Stage 3 — graph view (fraud_graph.py · NetworkX + Louvain) */
export interface GraphFraudNode {
  id: string;
  label: string;
  x: number;
  y: number;
  inSuspiciousCluster: boolean;
}

export interface GraphFraudEdge {
  from: string;
  to: string;
}

export interface GraphFraudResult {
  nodes: GraphFraudNode[];
  edges: GraphFraudEdge[];
  suspiciousClusterSize: number;
  louvainModularity: number;
}

export interface IncomeModelResult {
  expectedIncome: number;
  actualIncome: number;
  incomeLoss: number;
  disruptionLossPct: number;
  weeklyBaseline: number;
  modelVersion: string;
}

export interface PremiumModelResult {
  basePremium: number;
  personalizedPremium: number;
  expectedLoss: number;
  expenseLoading: number;
  riskMargin: number;
  cityMultiplier: number;
  planTier: 'basic' | 'standard' | 'premium';
  zoneRiskScore: number;
}

export type PayoutUiPhase = 'idle' | 'processing' | 'success' | 'held' | 'partial';

export interface LogEntry {
  id: string;
  timestamp: string;
  subsystem: 'SYSTEM' | 'ORACLE' | 'RULES' | 'BEHAVIOR' | 'DECISION' | 'FRAUD';
  message: string;
  cls?: string;
}

export type PipelineStage = 'idle' | 'running' | 'done';

export interface SimulationState {
  isRunning: boolean;
  currentWorkerIdx: number;
  currentEvent: DisruptionEvent | null;
  pipelineStages: PipelineStage[];
  logs: LogEntry[];
  ruleResult: RuleEngineResult | null;
  behaviorResult: BehaviorResult | null;
  graphFraudResult: GraphFraudResult | null;
  decisionResult: DecisionResult | null;
  featureImportance: FeatureImportance[] | null;
  gauges: {
    rainfall: number;
    aqi: number;
    traffic: number;
  };
  totalPayout: number;
  claimCount: number;
  riskScore: number;
  showModal: boolean;
  showTriggerBanner: boolean;
  triggerHeadline: string;
  triggerSubline: string;
  payoutPhase: PayoutUiPhase;
  payoutAmount: number | null;
  payoutUpiRef: string | null;
  incomeModelResult: IncomeModelResult | null;
  premiumModelResult: PremiumModelResult | null;
}
