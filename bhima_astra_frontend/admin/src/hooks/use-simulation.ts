import { useState, useCallback, useRef } from 'react';
import type {
  SimulationState,
  LogEntry,
  PipelineStage,
  Worker,
  DisruptionEvent,
  IncomeModelResult,
  PremiumModelResult
} from '../lib/types';
import { WORKERS, EVENTS } from '../lib/data';
import {
  runRuleEngine,
  computeBehaviorScore,
  makeFraudDecision,
  generateFeatureImportance,
  generateMotionTrace,
  getTimestamp,
  generateLogId,
  buildGraphFraudView
} from '../lib/engine';

function triggerHeadlineForEvent(evt: DisruptionEvent): string {
  const primary = (evt.trigger.split(',')[0] || 'policy').trim().toUpperCase();
  let level = 'L1';
  if (evt.rainfall > 60 && evt.aqi > 400) level = 'L3';
  else if (evt.rainfall > 45 || evt.aqi > 300 || evt.traffic > 75) level = 'L2';
  return `TRIGGER DETECTED — ${primary} ${level}`;
}

function triggerSublineForEvent(evt: DisruptionEvent): string {
  const n = 28 + evt.day * 9 + evt.hour + WORKERS.length * 3;
  return `Creating claims for ${n} workers...`;
}

/* ── Income Model (income_model.pkl · Random Forest Regressor) ──────────────
   Mirrors POST /ml/income-predict logic from Section 6.1 of the docs.
   18-feature RF: orders_per_day, earnings_per_order, shift_hours, surge,
   geo_zone, experience_level, day_of_week, peak_hour_flag, etc.
   We derive a deterministic-enough simulation from worker + event data.
─────────────────────────────────────────────────────────────────────────────*/
function computeIncomeModel(worker: Worker, evt: DisruptionEvent): IncomeModelResult {
  const ordersPerDay     = 28 + Math.round(worker.features.app_interaction_count * 0.6);
  const earningsPerOrder = 48 + worker.features.accelerometer_variance * 1.2;
  const surgeMultiplier  = evt.traffic > 75 ? 0.72 : evt.traffic > 50 ? 0.88 : 1.05;

  const expectedIncome = Math.round(ordersPerDay * earningsPerOrder * surgeMultiplier);
  const weeklyBaseline = Math.round(expectedIncome * 6.2);

  const suppressionFactor = Math.min(0.85, evt.composite * 0.9);
  const actualIncome      = Math.round(expectedIncome * (1 - suppressionFactor));
  const incomeLoss        = expectedIncome - actualIncome;
  const disruptionLossPct = parseFloat(((incomeLoss / expectedIncome) * 100).toFixed(1));

  return {
    expectedIncome,
    actualIncome,
    incomeLoss,
    disruptionLossPct,
    weeklyBaseline,
    modelVersion: 'rf_income_v2.1',
  };
}

/* ── Premium Model (premium_model.pkl · Ridge Regression α=1.0) ─────────────
   Mirrors POST /ml/premium-calculate logic from Section 6.3 of the docs.
   Formula: weekly_premium = E[L] + expense_loading(10-15%) + risk_margin(20-30%)
─────────────────────────────────────────────────────────────────────────────*/
function computePremiumModel(
  worker: Worker,
  incomeResult: IncomeModelResult,
  zoneRiskScore: number
): PremiumModelResult {
  const disruptionProb = Math.min(0.95, worker.graph.tabular_prob * 0.4 + zoneRiskScore * 0.6);
  const expectedLoss   = Math.round(disruptionProb * incomeResult.incomeLoss);
  const expenseLoading = Math.round(expectedLoss * (0.10 + worker.graph.fraud_cluster_score * 0.05));
  const riskMargin     = Math.round(expectedLoss * (0.20 + zoneRiskScore * 0.10));

  const cityMultiplier =
    ['Delhi','Mumbai','Bangalore'].includes(worker.city) ? 1.2 :
    ['Hyderabad','Pune','Chennai'].includes(worker.city) ? 1.0 : 0.85;

  const rawPremium = expectedLoss + expenseLoading + riskMargin;
  let planTier: 'basic' | 'standard' | 'premium' = 'standard';
  let basePremium = 79;

  if (rawPremium < 60 || worker.fraud_risk < 0.25) {
    planTier = 'basic'; basePremium = 49;
  } else if (rawPremium > 100 || worker.fraud_risk > 0.55) {
    planTier = 'premium'; basePremium = 119;
  }

  const raw = basePremium + (rawPremium * 0.012);
  const cap = basePremium * 0.20;
  const personalizedPremium = parseFloat(
    Math.min(basePremium + cap, Math.max(basePremium - cap, raw)).toFixed(2)
  );

  return {
    basePremium,
    personalizedPremium,
    expectedLoss,
    expenseLoading,
    riskMargin,
    cityMultiplier,
    planTier,
    zoneRiskScore: parseFloat(zoneRiskScore.toFixed(4)),
  };
}

const initialState: SimulationState = {
  isRunning: false,
  currentWorkerIdx: 0,
  currentEvent: null,
  pipelineStages: ['idle', 'idle', 'idle', 'idle', 'idle'],
  logs: [
    { id: 'init-1', timestamp: '00:00:00', subsystem: 'SYSTEM', message: 'Bhima Astra initialized. All subsystems nominal.' },
    { id: 'init-2', timestamp: '00:00:01', subsystem: 'SYSTEM', message: 'Select a worker profile and press Run Simulation.' }
  ],
  ruleResult: null,
  behaviorResult: null,
  graphFraudResult: null,
  decisionResult: null,
  featureImportance: null,
  gauges: { rainfall: 0, aqi: 0, traffic: 0 },
  totalPayout: 482350,
  claimCount: 847,
  riskScore: 0.12,
  showModal: false,
  showTriggerBanner: false,
  triggerHeadline: '',
  triggerSubline: '',
  payoutPhase: 'idle',
  payoutAmount: null,
  payoutUpiRef: null,
  incomeModelResult: null,
  premiumModelResult: null,
};

export function useSimulation() {
  const [state, setState] = useState<SimulationState>(initialState);
  const [motionTrace, setMotionTrace] = useState<number[]>([]);
  const [latency, setLatency] = useState(12);
  const abortRef = useRef(false);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const addLog = useCallback(
    (subsystem: LogEntry['subsystem'], message: string, cls?: string) => {
      const newLog: LogEntry = { id: generateLogId(), timestamp: getTimestamp(), subsystem, message, cls };
      setState((prev) => ({ ...prev, logs: [...prev.logs, newLog] }));
    },
    []
  );

  const setPipelineStage = useCallback((idx: number, stage: PipelineStage) => {
    setState((prev) => {
      const stages = [...prev.pipelineStages];
      for (let i = 0; i < 5; i++) {
        if (i < idx) stages[i] = 'done';
        else if (i === idx) stages[i] = stage;
      }
      return { ...prev, pipelineStages: stages };
    });
  }, []);

  const setAllPipelinesDone = useCallback(() => {
    setState((prev) => ({ ...prev, pipelineStages: ['done', 'done', 'done', 'done', 'done'] }));
  }, []);

  const onWorkerChange = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      currentWorkerIdx: idx,
      ruleResult: null,
      behaviorResult: null,
      graphFraudResult: null,
      decisionResult: null,
      featureImportance: null,
      pipelineStages: ['idle', 'idle', 'idle', 'idle', 'idle'],
      showTriggerBanner: false,
      triggerHeadline: '',
      triggerSubline: '',
      payoutPhase: 'idle',
      payoutAmount: null,
      payoutUpiRef: null,
      incomeModelResult: null,
      premiumModelResult: null,
    }));
    setMotionTrace([]);
  }, []);

  const resetAll = useCallback(() => {
    abortRef.current = true;
    setState({
      ...initialState,
      logs: [{ id: generateLogId(), timestamp: getTimestamp(), subsystem: 'SYSTEM', message: 'System reset. Ready.' }]
    });
    setMotionTrace([]);
    setLatency(12);
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, showModal: false }));
  }, []);

  const runSimulation = useCallback(async () => {
    if (state.isRunning) return;
    abortRef.current = false;

    setState((prev) => ({
      ...prev,
      isRunning: true,
      logs: [],
      ruleResult: null,
      behaviorResult: null,
      graphFraudResult: null,
      decisionResult: null,
      featureImportance: null,
      pipelineStages: ['idle', 'idle', 'idle', 'idle', 'idle'],
      gauges: { rainfall: 0, aqi: 0, traffic: 0 },
      showTriggerBanner: false,
      triggerHeadline: '',
      triggerSubline: '',
      payoutPhase: 'idle',
      payoutAmount: null,
      payoutUpiRef: null,
      incomeModelResult: null,
      premiumModelResult: null,
    }));
    setMotionTrace([]);

    const worker: Worker = WORKERS[state.currentWorkerIdx];
    const evt: DisruptionEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    setState((prev) => ({
      ...prev,
      currentEvent: evt,
      showTriggerBanner: true,
      triggerHeadline: triggerHeadlineForEvent(evt),
      triggerSubline: triggerSublineForEvent(evt)
    }));

    /* ════ BOOT ════ */
    addLog('SYSTEM', 'Initializing Astra simulation pipeline...');
    await sleep(350); if (abortRef.current) return;
    addLog('SYSTEM', `Worker: ${worker.name} [${worker.id}]`);
    await sleep(250); if (abortRef.current) return;
    addLog('SYSTEM', `Loading disruption event ${evt.id} from disruption.csv`);
    await sleep(300); if (abortRef.current) return;

    /* ════ STAGE 0 — ORACLE / MONITOR AGENT ════ */
    setPipelineStage(0, 'running');
    addLog('ORACLE', `Environmental scan initiated. Zone: ${worker.city}`);
    await sleep(450); if (abortRef.current) return;

    setState((prev) => ({ ...prev, gauges: { ...prev.gauges, rainfall: evt.rainfall } }));
    await sleep(280); if (abortRef.current) return;
    setState((prev) => ({ ...prev, gauges: { ...prev.gauges, aqi: evt.aqi } }));
    await sleep(280); if (abortRef.current) return;
    setState((prev) => ({ ...prev, gauges: { ...prev.gauges, traffic: evt.traffic } }));
    await sleep(280); if (abortRef.current) return;

    if (evt.rainfall > 45) addLog('ORACLE', `\u2691 Threshold ${evt.rainfall.toFixed(1)}mm exceeded. Initiating Astra-Check.`, 'warn');
    if (evt.aqi > 300)     addLog('ORACLE', `\u2691 AQI ${evt.aqi} exceeds L3 threshold. Policy trigger active.`, 'warn');
    if (evt.traffic > 75)  addLog('ORACLE', `\u2691 Traffic index ${evt.traffic.toFixed(1)}% — Zone shutdown check.`, 'warn');
    addLog('ORACLE', `Composite disruption score: ${evt.composite.toFixed(4)}`);
    if (evt.flood_alert)   addLog('ORACLE', 'Flood alert: ACTIVE — Road closures detected.', 'warn');
    if (evt.road_closure)  addLog('ORACLE', 'Road closure flag: ON — Delivery zone restricted.', 'warn');
    await sleep(500); if (abortRef.current) return;

    /* ════ INCOME MODEL — income_model.pkl (RandomForestRegressor) ════ */
    addLog('SYSTEM', 'Running income_model.pkl (RandomForestRegressor · 18 features)...');
    await sleep(380); if (abortRef.current) return;

    const incomeResult = computeIncomeModel(worker, evt);

    addLog('SYSTEM', `Expected income:    \u20B9${incomeResult.expectedIncome.toLocaleString('en-IN')}/day`);
    await sleep(200); if (abortRef.current) return;
    addLog('SYSTEM', `Actual (disrupted): \u20B9${incomeResult.actualIncome.toLocaleString('en-IN')}/day`);
    await sleep(200); if (abortRef.current) return;
    addLog(
      'SYSTEM',
      `Income suppression: ${incomeResult.disruptionLossPct}%  (\u2212\u20B9${incomeResult.incomeLoss.toLocaleString('en-IN')})`,
      incomeResult.disruptionLossPct > 50 ? 'warn' : ''
    );
    await sleep(200); if (abortRef.current) return;

    const zoneRiskScore = Math.min(0.99, evt.composite * 0.55 + worker.fraud_risk * 0.45);

    /* ════ PREMIUM MODEL — premium_model.pkl (Ridge Regression α=1.0) ════ */
    addLog('SYSTEM', 'Running premium_model.pkl (Ridge Regression \u03B1=1.0 \u00B7 actuarial)...');
    await sleep(350); if (abortRef.current) return;

    const premiumResult = computePremiumModel(worker, incomeResult, zoneRiskScore);

    addLog('SYSTEM', `E[L] expected loss:    \u20B9${premiumResult.expectedLoss}`);
    await sleep(160); if (abortRef.current) return;
    addLog('SYSTEM', `Expense loading:       \u20B9${premiumResult.expenseLoading}  (10\u201315%)`);
    await sleep(160); if (abortRef.current) return;
    addLog('SYSTEM', `Risk margin:           \u20B9${premiumResult.riskMargin}  (20\u201330%)`);
    await sleep(160); if (abortRef.current) return;
    addLog(
      'SYSTEM',
      `Personalised premium:  \u20B9${premiumResult.personalizedPremium}/wk  [${premiumResult.planTier.toUpperCase()} \u00B7 ${premiumResult.cityMultiplier}\u00D7 city]`,
      'good'
    );
    await sleep(280); if (abortRef.current) return;

    setState((prev) => ({ ...prev, incomeModelResult: incomeResult, premiumModelResult: premiumResult }));
    await sleep(200); if (abortRef.current) return;

    /* ════ STAGE 1 — RULE ENGINE ════ */
    setState((prev) => ({ ...prev, showTriggerBanner: false }));
    setPipelineStage(1, 'running');
    addLog('RULES', 'Checking deterministic pre-filters (Stage 1)...');
    await sleep(400); if (abortRef.current) return;

    const ruleResult = runRuleEngine(worker.features);
    const f = worker.features;

    addLog('RULES', `GPS delta: ${f.gps_tower_delta}m (threshold: 500m)`, f.gps_tower_delta > 500 ? 'warn' : '');
    await sleep(200); if (abortRef.current) return;
    addLog('RULES', `Accel variance: ${f.accelerometer_variance.toFixed(3)} (min: 0.5)`, f.accelerometer_variance < 0.5 ? 'warn' : '');
    await sleep(200); if (abortRef.current) return;
    addLog('RULES', `Response time: ${f.claim_response_time_sec}s (threshold: 60s)`, f.claim_response_time_sec < 60 ? 'warn' : '');
    await sleep(200); if (abortRef.current) return;
    addLog('RULES', `Device flagged: ${f.device_flagged ? 'YES \u26A0' : 'No'}`, f.device_flagged ? 'warn' : '');
    await sleep(300); if (abortRef.current) return;

    setState((prev) => ({ ...prev, ruleResult }));

    if (ruleResult.rule_decision === 'REVIEW') {
      addLog('RULES', `\u2691 REVIEW — ${ruleResult.rule_flags.length} flag(s): [${ruleResult.rule_flags.join(', ')}]`, 'warn');
    } else {
      addLog('RULES', '\u2713 All rules passed. Decision: PASS', 'good');
    }
    await sleep(500); if (abortRef.current) return;

    /* ════ STAGE 2 — BEHAVIOR MODEL (LSTM) ════ */
    setPipelineStage(2, 'running');
    addLog('BEHAVIOR', 'Loading LSTM-style behavioral signature (Stage 2)...');
    await sleep(400); if (abortRef.current) return;
    addLog('BEHAVIOR', `Worker ${worker.id} · Analyzing movement patterns`);
    await sleep(350); if (abortRef.current) return;

    const behaviorResult = computeBehaviorScore(worker.features);
    const bs = behaviorResult.behavior_score;
    const trace = generateMotionTrace(worker.features.accelerometer_variance);
    setMotionTrace(trace);
    setState((prev) => ({ ...prev, behaviorResult }));

    const bsLabel = bs < 0.3 ? 'NORMAL' : bs < 0.7 ? 'SUSPICIOUS' : 'HIGH ANOMALY';
    addLog('BEHAVIOR', `GPS component:         ${(behaviorResult.gpsComp * 100).toFixed(0)}%`);
    await sleep(180); if (abortRef.current) return;
    addLog('BEHAVIOR', `Motion component:      ${(behaviorResult.motionComp * 100).toFixed(0)}%`);
    await sleep(180); if (abortRef.current) return;
    addLog('BEHAVIOR', `Interaction component: ${(behaviorResult.interactComp * 100).toFixed(0)}%`);
    await sleep(180); if (abortRef.current) return;
    addLog('BEHAVIOR', `Behavior score: ${bs.toFixed(4)}  [${bsLabel}]`, bs > 0.5 ? 'warn' : 'good');
    await sleep(550); if (abortRef.current) return;

    /* ════ STAGE 3 — GRAPH FRAUD (NetworkX + Louvain) ════ */
    setPipelineStage(3, 'running');
    addLog('FRAUD', 'Loading worker relationship graph (fraud_graph.py · NetworkX)...');
    await sleep(380); if (abortRef.current) return;
    addLog('FRAUD', 'Running Louvain community detection on co-claim edges...');
    await sleep(420); if (abortRef.current) return;

    const graphFraudResult = buildGraphFraudView(worker);
    setState((prev) => ({ ...prev, graphFraudResult }));

    addLog('FRAUD', `Partition modularity Q = ${graphFraudResult.louvainModularity.toFixed(3)} · flagged cluster size = ${graphFraudResult.suspiciousClusterSize}`);
    await sleep(400); if (abortRef.current) return;
    addLog('FRAUD', `Cluster fraud score (graph signal): ${worker.graph.fraud_cluster_score.toFixed(4)}`);
    await sleep(480); if (abortRef.current) return;

    /* ════ STAGE 4 — DECISION ENGINE ════ */
    setPipelineStage(4, 'running');
    addLog('DECISION', 'Running adaptive percentile decision engine (Stage 4)...');
    await sleep(400); if (abortRef.current) return;
    addLog('DECISION', 'Loading calibration distribution from fraud_score_calibration.pkl');
    await sleep(500); if (abortRef.current) return;

    const decisionResult = makeFraudDecision(
      worker.graph.tabular_prob,
      worker.graph.fraud_cluster_score,
      worker.graph.cluster_size,
      bs,
      ruleResult.rule_score,
      worker.features
    );
    const featureImportance = generateFeatureImportance(worker.features, behaviorResult);

    addLog('DECISION', `Tabular fraud prob:  ${worker.graph.tabular_prob.toFixed(4)}`);
    await sleep(180); if (abortRef.current) return;
    addLog('DECISION', `Cluster score:       ${worker.graph.fraud_cluster_score.toFixed(4)}  (cluster size: ${worker.graph.cluster_size})`);
    await sleep(180); if (abortRef.current) return;
    addLog('DECISION', `Behavior score:      ${bs.toFixed(4)}  (weight: 0.15)`);
    await sleep(180); if (abortRef.current) return;
    addLog('DECISION', `Rule score:          ${ruleResult.rule_score.toFixed(4)}  (weight: 0.10)`);
    await sleep(180); if (abortRef.current) return;
    addLog('DECISION', `Final score:         ${decisionResult.finalScore.toFixed(4)}  |  Percentile: ${decisionResult.percentile.toFixed(4)}`);
    await sleep(350); if (abortRef.current) return;

    const decCls: Record<string, string> = { APPROVE: 'good', REVIEW: 'warn', BLOCK: 'danger' };
    addLog('DECISION', `\u2550\u2550 VERDICT: ${decisionResult.decision} \u2550\u2550  Payout: ${decisionResult.payoutStatus}`, `${decCls[decisionResult.decision] || ''} bold`);
    addLog('DECISION', `Primary reason: ${decisionResult.primary_reason}`, decCls[decisionResult.decision] || '');

    setAllPipelinesDone();

    // Payout anchored to income loss (docs Section 6.1)
    const basePayout = Math.max(600, Math.min(2000, Math.round(incomeResult.incomeLoss * premiumResult.cityMultiplier)));
    const upiRef = `UPI/${generateLogId().slice(4, 14)}`;
    const reviewAmount = decisionResult.decision === 'REVIEW' ? Math.max(100, Math.floor(basePayout * 0.42)) : basePayout;

    setState((prev) => ({
      ...prev,
      riskScore: decisionResult.finalScore,
      decisionResult,
      featureImportance,
      payoutPhase: 'processing',
      payoutAmount: reviewAmount,
      payoutUpiRef: upiRef
    }));

    await sleep(720); if (abortRef.current) return;

    const nextPayoutPhase =
      decisionResult.decision === 'APPROVE' ? 'success' :
      decisionResult.decision === 'REVIEW'  ? 'partial' : 'held';

    setState((prev) => ({ ...prev, payoutPhase: nextPayoutPhase }));
    await sleep(520); if (abortRef.current) return;

    if (decisionResult.decision === 'APPROVE') {
      setState((prev) => ({ ...prev, totalPayout: prev.totalPayout + basePayout, claimCount: prev.claimCount + 1 }));
    }

    setLatency(6 + Math.floor(Math.random() * 18));
    await sleep(400); if (abortRef.current) return;

    setState((prev) => ({ ...prev, isRunning: false, showModal: true }));
  }, [
    state.isRunning,
    state.currentWorkerIdx,
    addLog,
    setPipelineStage,
    setAllPipelinesDone
  ]);

  const currentWorker = WORKERS[state.currentWorkerIdx];

  return { state, currentWorker, motionTrace, latency, runSimulation, resetAll, onWorkerChange, closeModal };
}
