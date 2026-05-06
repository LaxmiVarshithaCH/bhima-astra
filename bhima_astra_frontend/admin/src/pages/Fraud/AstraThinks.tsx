import { useEffect, useRef, useCallback, useState } from "react";
import { refreshWorkersFromAPI } from "../../lib/data";

import { motion } from "framer-motion";

import "../../styles/bhima-astra.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { WORKERS } from "../../lib/data";
import { useSimulation } from "../../hooks/use-simulation";
import { Nav } from "../../components/bhima/nav";
import { Pipeline } from "../../components/bhima/pipeline";
import { WorkerCard } from "../../components/bhima/worker-card";
import { RulesCard } from "../../components/bhima/rules-card";
import { OracleCard } from "../../components/bhima/oracle-card";
import { Terminal } from "../../components/bhima/terminal";
import { BehavioralCard } from "../../components/bhima/behavioral-card";
import { GraphFraudCard } from "../../components/bhima/graph-fraud-card";
import { DecisionModal } from "../../components/bhima/decision-modal";
import { Footer } from "../../components/bhima/footer";
import { AstraNeuralVisual } from "../../components/bhima/astra-neural-visual";
import { TriggerAlertBanner } from "../../components/bhima/trigger-alert-banner";
import { PayoutCard } from "../../components/bhima/payout-card";
import { IncomeModelCard } from "../../components/bhima/income-model-card";
import { PremiumModelCard } from "../../components/bhima/premium-model-card";

type InjectedTriggerContext = {
  worker_id: string;
  trigger_id: string;
  zone: string;
  trigger_type: string;
  severity: string;
  payout_status: string;
};

type AstraThinksProps =
  | {
      injected?: InjectedTriggerContext;
    }
  | (Partial<Omit<InjectedTriggerContext, "trigger_id">> & {
      injected?: InjectedTriggerContext;
      trigger_id?: string;
    });

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function BhimaAstra(props: AstraThinksProps) {
  const injected: InjectedTriggerContext | undefined =
    (props as any)?.injected ??
    (props && (props as any).worker_id
      ? {
          worker_id: String((props as any).worker_id ?? ""),
          trigger_id: String((props as any).trigger_id ?? ""),
          zone: String((props as any).zone ?? ""),
          trigger_type: String((props as any).trigger_type ?? ""),
          severity: String((props as any).severity ?? ""),
          payout_status: String((props as any).payout_status ?? ""),
        }
      : undefined);

  const {
    state,
    currentWorker,
    motionTrace,
    latency,
    runSimulation,
    resetAll,
    onWorkerChange,
    closeModal,
  } = useSimulation();

  // Refresh WORKERS array from real DB on mount (replaces static mock data)
  useEffect(() => {
    refreshWorkersFromAPI().catch(() => {
      /* silent - keep seed data */
    });
  }, []);

  // ── Continuous fraud detection polling ──────────────────────────────────
  const [pendingFraudCount, setPendingFraudCount] = useState(0);
  const [currentProcessingTrigger, setCurrentProcessingTrigger] = useState<
    InjectedTriggerContext | undefined
  >(undefined);
  const queuedClaimIdsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggerQueueRef = useRef<InjectedTriggerContext[]>([]);
  const isProcessingRef = useRef(false);
  const lastSimIdRef = useRef<string | null>(null);

  const fetchPendingFraud = useCallback(async () => {
    try {
      const BASE_URL =
        (typeof import.meta !== "undefined" &&
          (import.meta as any).env?.VITE_API_BASE_URL) ||
        "";
      const token = localStorage.getItem("bhima_admin_token") || "";
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(`${BASE_URL}/api/v1/admin/fraud/pending`, {
        headers,
      });
      if (!res.ok) return;
      const data = await res.json();
      const items: Array<{
        claim_id: number;
        worker_id: number;
        zone: string;
        trigger_type: string;
        trigger_level: string;
        payout_status: string;
      }> = data?.items || [];

      console.log(
        `[FraudDetection] Fetched ${items.length} pending fraud claims`,
        items.map((i) => ({ workerId: i.worker_id, claimId: i.claim_id })),
      );
      setPendingFraudCount(items.length);

      // Build trigger contexts from pending fraud items
      const newContexts: InjectedTriggerContext[] = items.map((item) => ({
        worker_id: String(item.worker_id),
        trigger_id: `TRG-${item.claim_id}`,
        zone: item.zone || "Vasant Kunj",
        trigger_type: item.trigger_type || "composite",
        severity: item.trigger_level || "L2",
        payout_status: item.payout_status || "blocked",
      }));

      // Add only new ones not already queued to trigger queue
      if (newContexts.length > 0 && !injected?.trigger_id) {
        // Filter out claims already queued
        const newItems = newContexts.filter(
          (ctx) => !queuedClaimIdsRef.current.has(ctx.trigger_id),
        );

        if (newItems.length > 0) {
          console.log(
            `[FraudDetection] Adding ${newItems.length} new items to trigger queue`,
            newItems.map((i) => ({
              workerId: i.worker_id,
              triggerId: i.trigger_id,
            })),
          );

          // Add each new item to the trigger queue and mark as queued
          newItems.forEach((item) => {
            triggerQueueRef.current.push(item);
            queuedClaimIdsRef.current.add(item.trigger_id);
          });

          console.log(
            `[FraudDetection] Trigger queue now has ${triggerQueueRef.current.length} items`,
          );

          // Kick off processing if not already in progress
          if (!isProcessingRef.current && triggerQueueRef.current.length > 0) {
            console.log(`[FraudDetection] Kicking off processNextTrigger`);
            processNextTriggerRef.current();
          }
        }
      }
    } catch {
      // silent — fallback queue stays empty
    }
  }, [injected]);

  // Poll every 5s for new fraud-pending claims when no injected context
  useEffect(() => {
    if (injected?.trigger_id) return; // manual navigation takes priority
    fetchPendingFraud();
    pollIntervalRef.current = setInterval(fetchPendingFraud, 5000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [injected, fetchPendingFraud]);

  // ── Poll localStorage for simulation workers and queue ALL for fraud detection
  useEffect(() => {
    if (injected?.trigger_id) return; // manual nav takes priority
    const SIM_LS_KEY = "bhima_active_simulation";

    const checkSim = () => {
      const raw = localStorage.getItem(SIM_LS_KEY);
      if (!raw) return;
      try {
        const sim = JSON.parse(raw);
        if (!sim?.simulation_id) return;
        if (sim.simulation_id === lastSimIdRef.current) return;
        lastSimIdRef.current = sim.simulation_id;

        const simWorkers: Array<{ worker_id: number; worker_id_str?: string }> =
          Array.isArray(sim.workers) ? sim.workers : [];

        if (simWorkers.length === 0) return;

        console.log(
          `[FraudDetection] Simulation ${sim.simulation_id} detected with ${simWorkers.length} workers`,
        );

        // Queue ALL simulation workers for fraud detection
        simWorkers.forEach((w) => {
          const wId = w.worker_id_str || String(w.worker_id);
          if (queuedClaimIdsRef.current.has(wId)) return;

          const ctx: InjectedTriggerContext = {
            worker_id: wId,
            trigger_id: `SIM-${sim.simulation_id}`,
            zone: sim.zone_id || "Vasant Kunj",
            trigger_type: sim.trigger_type || "composite",
            severity: sim.trigger_level || "L2",
            payout_status: "pending",
          };
          triggerQueueRef.current.push(ctx);
          queuedClaimIdsRef.current.add(wId);
        });

        console.log(
          `[FraudDetection] Queue depth: ${triggerQueueRef.current.length}`,
        );

        // Kick off processing
        if (!isProcessingRef.current && triggerQueueRef.current.length > 0) {
          processNextTriggerRef.current();
        }
      } catch {
        // silent
      }
    };

    checkSim();
    const iv = setInterval(checkSim, 2000);
    return () => clearInterval(iv);
  }, [injected]);

  // Stable ref so the fetch effect and queue processing can call processNextTrigger
  // without listing it in the deps array (avoids TDZ since it's declared below).
  const processNextTriggerRef = useRef<() => void>(() => {});

  // --- Queue-based delayed processing ---
  const prevInjectedRef = useRef<InjectedTriggerContext | null>(null);

  // --- CHANGE 7: Dynamic worker mapping from trigger ---
  // Try multiple ID formats to find worker in array, don't default to 0
  const resolveWorkerIdx = useCallback((workerId: string) => {
    // Normalize: strip leading zeros, W prefix variations
    const norm = workerId.trim();

    // 1. Exact match
    let idx = WORKERS.findIndex((w) => w.id === norm);
    if (idx >= 0) return idx;

    // 2. Pure number → W-XXXX
    if (!isNaN(Number(norm))) {
      const padded = `W-${norm.padStart(4, "0")}`;
      idx = WORKERS.findIndex((w) => w.id === padded);
      if (idx >= 0) return idx;
    }

    // 3. "W123" or "W68" → "W-0123" / "W-0068"
    if (/^W\d+$/.test(norm)) {
      const num = norm.substring(1);
      const padded = `W-${num.padStart(4, "0")}`;
      idx = WORKERS.findIndex((w) => w.id === padded);
      if (idx >= 0) return idx;
      // unpadded
      idx = WORKERS.findIndex((w) => w.id === `W-${num}`);
      if (idx >= 0) return idx;
    }

    // 4. "W-123" → "W-0123"
    if (/^W-\d+$/.test(norm)) {
      const num = norm.substring(2);
      const padded = `W-${num.padStart(4, "0")}`;
      idx = WORKERS.findIndex((w) => w.id === padded);
      if (idx >= 0) return idx;
    }

    // 5. Partial/fuzzy match on numeric portion
    const numMatch = norm.match(/\d+/);
    if (numMatch) {
      const n = parseInt(numMatch[0], 10);
      idx = WORKERS.findIndex((w) => {
        const wNum = parseInt((w.id || "").replace(/\D/g, ""), 10);
        return wNum === n;
      });
      if (idx >= 0) return idx;
    }

    console.warn(`[FraudDetection] Worker ${workerId} not found in WORKERS array (len=${WORKERS.length}), using rotation`);
    return -1;
  }, []);

  const processNextTrigger = useCallback(() => {
    if (isProcessingRef.current) {
      console.log(`[FraudDetection] Already processing, skipping`);
      return;
    }
    if (triggerQueueRef.current.length === 0) {
      console.log(
        `[FraudDetection] Queue is empty, no more triggers to process`,
      );
      return;
    }

    isProcessingRef.current = true;
    const trigger = triggerQueueRef.current.shift()!;

    console.log(
      `[FraudDetection] Processing trigger: ${trigger.trigger_id} for worker ${trigger.worker_id}, queue depth: ${triggerQueueRef.current.length}`,
    );

    // Track current trigger being processed for display purposes
    setCurrentProcessingTrigger(trigger);

    // CHANGE 7: Select correct worker from trigger.worker_id
    let workerIdx = resolveWorkerIdx(trigger.worker_id);

    // If worker not found in array, use a random worker index
    if (workerIdx < 0) {
      workerIdx = Math.floor(Math.random() * Math.max(WORKERS.length, 1));
      console.log(
        `[FraudDetection] Worker ${trigger.worker_id} not in WORKERS, picking random idx ${workerIdx}`,
      );
    }

    onWorkerChange(workerIdx);

    // Minimal settle delay then run simulation
    setTimeout(() => {
      runSimulation();

      // Give enough time for the full pipeline to be visible (5-8 seconds per worker)
      const delay = 5000 + Math.random() * 3000;
      console.log(
        `[FraudDetection] Simulation started for ${trigger.trigger_id}, scheduling next in ${Math.round(delay)}ms`,
      );
      setTimeout(() => {
        console.log(
          `[FraudDetection] Simulation completed for ${trigger.trigger_id}, moving to next trigger`,
        );
        isProcessingRef.current = false;
        processNextTrigger();
      }, delay);
    }, 300);
  }, [resolveWorkerIdx, onWorkerChange, runSimulation]);

  // Sync the stable ref so the auto-cycle effect (defined above) can call
  // processNextTrigger without a TDZ / stale-closure problem.
  // This runs synchronously after every render, keeping the ref up-to-date.
  processNextTriggerRef.current = processNextTrigger;

  // --- CHANGE 3 & 6: React to incoming injected trigger automatically ---
  useEffect(() => {
    if (!injected?.trigger_id) return;

    const isSame =
      prevInjectedRef.current?.trigger_id === injected.trigger_id &&
      prevInjectedRef.current?.worker_id === injected.worker_id;

    if (isSame) return;

    prevInjectedRef.current = injected;

    // Enqueue the new trigger
    triggerQueueRef.current.push(injected);

    // Kick off processing if not already running
    processNextTrigger();
  }, [injected, processNextTrigger]);

  // ── Idle random worker rotation: when nothing is processing, cycle random workers ──
  useEffect(() => {
    if (injected?.trigger_id) return; // manual nav takes priority
    // Rotate to a random worker every 8 seconds when idle
    const idleTimer = setInterval(() => {
      if (!isProcessingRef.current && triggerQueueRef.current.length === 0) {
        const randomIdx = Math.floor(Math.random() * Math.max(WORKERS.length, 1));
        onWorkerChange(randomIdx);
      }
    }, 8000);
    return () => clearInterval(idleTimer);
  }, [injected, onWorkerChange]);

  // --- CHANGE 7: Always derive displayWorker from injected trigger or processing context ---
  // Use injected context if provided (manual nav), otherwise use current processing trigger
  const effectiveInjected = injected || currentProcessingTrigger;

  const displayWorker = effectiveInjected?.worker_id
    ? {
        ...currentWorker,
        id: effectiveInjected.worker_id,
        city: effectiveInjected.zone || currentWorker.city,
        zone: effectiveInjected.zone || currentWorker.zone,
      }
    : currentWorker;

  // Log when displaying a new worker from trigger context
  if (
    effectiveInjected?.worker_id &&
    effectiveInjected?.worker_id !== prevInjectedRef.current?.worker_id
  ) {
    console.log(
      `[FraudDetection] Now displaying worker ${effectiveInjected.worker_id} (${effectiveInjected.zone})`,
    );
  }

  const displayEvent = effectiveInjected?.trigger_id
    ? state.currentEvent
      ? {
          ...state.currentEvent,
          id: effectiveInjected.trigger_id || state.currentEvent.id,
          trigger: effectiveInjected.trigger_type || state.currentEvent.trigger,
          label: effectiveInjected.severity
            ? `${state.currentEvent.label} · ${effectiveInjected.severity}`
            : state.currentEvent.label,
        }
      : {
          id: effectiveInjected.trigger_id,
          day: 0,
          hour: 0,
          rainfall: 0,
          aqi: 0,
          traffic: 0,
          composite: 0,
          label: effectiveInjected.severity
            ? `External trigger · ${effectiveInjected.severity}`
            : "External trigger",
          trigger: effectiveInjected.trigger_type || "fraud",
          flood_alert: 0,
          road_closure: 0,
        }
    : state.currentEvent;

  return (
    <div className="bhima-app">
      <Nav />

      {/* HERO SECTION */}
      <motion.section
        className="hero max-w-[1440px] mx-auto px-8 min-h-[70vh] flex items-center"
        id="home"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="hero-split">
          {/* Left Side: Astra Thinks Text */}
          <div className="z-10">
            <motion.div className="hero-eyebrow" variants={fadeUp}>
              AI-Powered Risk Assessment
            </motion.div>
            <motion.h1 className="hero-title" variants={fadeUp}>
              Astra
              <br />
              <em>Thinks.</em>
            </motion.h1>
            <motion.p className="hero-sub" variants={fadeUp}>
              Real-time parametric insurance &amp; fraud detection.
              <br />
              Watch the pipeline make decisions — live.
            </motion.p>
            {/* CHANGE 1 & 4: Removed Run Simulation button and worker dropdown */}
            {/* CHANGE 2: StatsBand removed below — no replacement */}
          </div>

          {/* Right Side: The Map */}
          <motion.div variants={fadeUp} className="hero-visual">
            <div className="hero-visual-inner">
              <AstraNeuralVisual isRunning={state.isRunning} />
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* CHANGE 2: StatsBand intentionally removed */}

      <TriggerAlertBanner
        visible={state.showTriggerBanner}
        headline={state.triggerHeadline}
        subline={state.triggerSubline}
      />
      <Pipeline stages={state.pipelineStages} />
      <section className="worker-section">
        <div className="worker-grid">
          <WorkerCard worker={displayWorker} />
          <RulesCard ruleResult={state.ruleResult} />
        </div>
      </section>
      <section className="worker-section" style={{ paddingTop: 0 }}>
        <div className="worker-grid">
          <IncomeModelCard
            result={state.incomeModelResult}
            isActive={state.isRunning && state.pipelineStages[0] === "running"}
          />
          <PremiumModelCard
            result={state.premiumModelResult}
            isActive={state.isRunning && state.pipelineStages[0] === "running"}
          />
        </div>
      </section>
      <section className="sim-core" id="oracle">
        <div className="sim-three-col">
          <OracleCard
            event={displayEvent}
            gauges={state.gauges}
            isRunning={state.isRunning}
          />
          <Terminal logs={state.logs} eventId={displayEvent?.id || "—"} />
          <BehavioralCard
            behaviorResult={state.behaviorResult}
            motionTrace={motionTrace}
            gpsDelta={displayWorker.features.gps_tower_delta}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <GraphFraudCard
            graphResult={state.graphFraudResult}
            clusterScore={displayWorker.graph.fraud_cluster_score}
            isGraphActive={
              state.isRunning && state.pipelineStages[3] === "running"
            }
          />
          <PayoutCard
            phase={state.payoutPhase}
            amount={state.payoutAmount}
            upiRef={state.payoutUpiRef}
          />
        </div>
      </section>
      <DecisionModal
        isOpen={state.showModal}
        onClose={closeModal}
        decisionResult={state.decisionResult}
        featureImportance={state.featureImportance}
        worker={displayWorker}
      />
      <Footer />
    </div>
  );
}
