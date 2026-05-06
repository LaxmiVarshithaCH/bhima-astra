import { useEffect, useRef, useState, useCallback } from "react";

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import Panel from "../../components/Panel";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtTime(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function parseIsoMs(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}

// Stage based on elapsed ms since simulation START
function stageAt(elapsedMs) {
  if (elapsedMs < 2000) return "trigger";
  if (elapsedMs < 4000) return "verification";
  if (elapsedMs < 6000) return "fraud";
  return "payout";
}

// Build worker rows for AFFECTED workers
function buildAffectedRows(triggerId, dbWorkers, startTime) {
  const base = startTime || Date.now();
  return dbWorkers.slice(0, 20).map((w) => ({
    worker_id: w.worker_id_str || `W${w.worker_id}`,
    worker_name: w.worker_name || `Worker ${w.worker_id}`,
    fraud_score: typeof w.fraud_score === "number" ? w.fraud_score : null,
    fraud_flag: !!w.fraud_flag,
    real_payout_status: w.payout_status || "pending",
    created_at: base,
    stage: "trigger",
    verification_status: "pending",
    fraud_status: "clean",
    payout_status: "pending",
    timeline: { trigger: fmtTime(base) },
    trigger_id: triggerId,
    is_affected: true,
  }));
}

// Build "completed" rows for NON-affected zone workers
function buildCompletedRows(triggerId, dbWorkers, affectedIds, startTime) {
  const base = (startTime || Date.now()) - 12000;
  return dbWorkers
    .filter((w) => {
      const id = w.worker_id_str || `W${w.worker_id}`;
      const numId = String(w.worker_id);
      return !affectedIds.has(id) && !affectedIds.has(numId);
    })
    .slice(0, 30)
    .map((w) => ({
      worker_id: w.worker_id_str || `W${w.worker_id}`,
      worker_name: w.worker_name || `Worker ${w.worker_id}`,
      fraud_score: 0,
      fraud_flag: false,
      real_payout_status: "paid",
      created_at: base,
      stage: "payout",
      verification_status: "verified",
      fraud_status: "clean",
      payout_status: "completed",
      timeline: {
        trigger: fmtTime(base),
        verification: fmtTime(base + 2000),
        fraud: fmtTime(base + 4000),
        payout: fmtTime(base + 6000),
      },
      trigger_id: triggerId,
      is_affected: false,
    }));
}

function statusColor(payout) {
  if (payout === "pending") return "text-[#FFB020]";
  if (payout === "processing") return "text-[#4DA3FF]";
  if (payout === "completed") return "text-[#34D399]";
  if (payout === "held") return "text-[#FF4D4D]";
  return "text-[#E5E5E5]";
}

function StageDot({ active, color }) {
  return (
    <span
      className={"h-2 w-2 rounded-full " + (active ? color : "bg-[#ffffff22]")}
    />
  );
}

function StageLabel({ active, children }) {
  return (
    <span
      className={
        "text-[10px] uppercase tracking-wider " +
        (active ? "text-[#FFFFFF]" : "text-[#999999]")
      }
    >
      {children}
    </span>
  );
}

const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "";

// localStorage key written by CommandCenter when simulation runs
const SIM_LS_KEY = "bhima_active_simulation";

export default function LiveTriggers() {
  const navigate = useNavigate();

  // ── Trigger context (most recent simulation/trigger)
  const [ev, setEv] = useState({
    id: "—",
    timestamp: new Date().toISOString(),
    zone: "—",
    trigger_type: "—",
    severity: "—",
    workers_affected: 0,
    workers_triggered: 0,
    simulation_id: null,
  });

  // ── workers: ALL zone workers (affected + non-affected)
  const [workers, setWorkers] = useState([]);

  const triggersRef = useRef(new Map());
  const startRef = useRef(Date.now());
  const fraudMapRef = useRef(new Map());
  const lastPolledTriggerId = useRef(null);
  const lastSimIdRef = useRef(null);
  const pollingRef = useRef(null);

  const token = localStorage.getItem("bhima_admin_token") || "";
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Fetch ALL workers in a zone from DB
  const fetchAllZoneWorkers = useCallback(
    async (zone) => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/v1/admin/simulate/zone-workers?zone_id=${encodeURIComponent(zone)}`,
          { headers: authHeader },
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn("[LiveTriggers] fetchAllZoneWorkers failed:", err.message);
        return [];
      }
    },
    [authHeader],
  );

  // ── Poll real DB status for affected workers and update their payout_status
  const pollRealStatus = useCallback(
    async (zone) => {
      if (!zone || zone === "—") return;
      try {
        const res = await fetch(
          `${BASE_URL}/api/v1/admin/simulate/zone-workers?zone_id=${encodeURIComponent(zone)}`,
          { headers: authHeader },
        );
        if (!res.ok) return;
        const dbWorkers = await res.json();
        if (!Array.isArray(dbWorkers)) return;

        // Build status map: worker_id_str -> payout_status
        const statusMap = new Map();
        dbWorkers.forEach((w) => {
          const id = w.worker_id_str || `W${w.worker_id}`;
          statusMap.set(id, w.payout_status || "pending");
          statusMap.set(String(w.worker_id), w.payout_status || "pending");
        });

        setWorkers((prev) =>
          prev.map((w) => {
            if (!w.is_affected) return w;
            const realStatus = statusMap.get(w.worker_id);
            if (realStatus && realStatus !== "pending") {
              return { ...w, real_payout_status: realStatus };
            }
            return w;
          }),
        );
      } catch (err) {
        // silent
      }
    },
    [authHeader],
  );

  // ── Poll localStorage for simulation events from CommandCenter
  useEffect(() => {
    const checkLocalStorage = async () => {
      try {
        const raw = localStorage.getItem(SIM_LS_KEY);
        if (!raw) return;
        const sim = JSON.parse(raw);
        if (!sim || !sim.simulation_id) return;
        if (lastSimIdRef.current === sim.simulation_id) return;

        lastSimIdRef.current = sim.simulation_id;
        const zone = sim.zone_id || "Vasant Kunj";
        const trigId = `SIM-${sim.simulation_id.slice(-8).toUpperCase()}`;
        const triggerStartTime = Date.now();

        // Build trigger context with full simulation details
        const newEv = {
          id: trigId,
          timestamp: sim.timestamp || new Date().toISOString(),
          zone,
          trigger_type: sim.trigger_type || "composite",
          severity: sim.trigger_level || "L2",
          workers_affected: sim.workers_triggered || 0,
          workers_triggered: sim.workers_triggered || 0,
          simulation_id: sim.simulation_id,
        };
        setEv(newEv);

        triggersRef.current.set(trigId, {
          ev: newEv,
          startTime: triggerStartTime,
        });

        // Build affected worker ID set from simulation payload
        const simWorkers = Array.isArray(sim.workers) ? sim.workers : [];
        const affectedIds = new Set();
        simWorkers.forEach((w) => {
          affectedIds.add(String(w.worker_id));
          if (w.worker_id_str) affectedIds.add(w.worker_id_str);
        });

        // Fetch ALL workers in this zone from DB
        const allZoneWorkers = await fetchAllZoneWorkers(zone);

        // Determine affected DB workers
        const affectedDbWorkers =
          simWorkers.length > 0
            ? simWorkers // use sim payload workers directly
            : allZoneWorkers.slice(0, 10); // fallback: first 10 zone workers

        // Build rows
        const affectedRows = buildAffectedRows(
          trigId,
          affectedDbWorkers,
          triggerStartTime,
        );
        const completedRows = buildCompletedRows(
          trigId,
          allZoneWorkers,
          affectedIds,
          triggerStartTime,
        );

        setWorkers([...affectedRows, ...completedRows]);
      } catch (e) {
        console.warn("[LiveTriggers] localStorage parse error:", e);
      }
    };

    checkLocalStorage();
    const iv = window.setInterval(checkLocalStorage, 1000);
    return () => window.clearInterval(iv);
  }, [fetchAllZoneWorkers]);

  // ── Continuous polling of latest triggers from DB (every 3 seconds)
  useEffect(() => {
    const pollLatestTriggers = async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/v1/admin/simulate/latest-from-db`,
          { headers: authHeader },
        );
        if (!res.ok) return;
        const data = await res.json();

        if (!data || !data.id || data.id === "TRG-000" || data.id === "TRG-ERR")
          return;
        if (lastPolledTriggerId.current === data.id) return;

        // Don't override a freshly started localStorage simulation
        if (
          lastSimIdRef.current &&
          Date.now() - startRef.current < 30000
        )
          return;

        lastPolledTriggerId.current = data.id;

        const newEv = {
          id: data.id,
          timestamp: data.timestamp || new Date().toISOString(),
          zone: data.zone || "Vasant Kunj",
          trigger_type: data.trigger_type || "composite",
          severity: data.severity || "L2",
          workers_affected: data.workers_affected || 0,
          workers_triggered: data.workers_affected || 0,
          simulation_id: null,
        };
        setEv(newEv);

        const triggerStartTime = Date.now();
        triggersRef.current.set(data.id, {
          ev: newEv,
          startTime: triggerStartTime,
        });

        if (Array.isArray(data.workers) && data.workers.length > 0) {
          const affectedIds = new Set(
            data.workers.map((w) => String(w.worker_id || w.worker_id_str)),
          );
          const affectedRows = buildAffectedRows(
            data.id,
            data.workers,
            triggerStartTime,
          );

          // Fetch zone workers for non-affected
          const allZoneWorkers = await fetchAllZoneWorkers(newEv.zone);
          const completedRows = buildCompletedRows(
            data.id,
            allZoneWorkers,
            affectedIds,
            triggerStartTime,
          );
          setWorkers([...affectedRows, ...completedRows]);
        }
      } catch (err) {
        console.warn("[LiveTriggers] pollLatestTriggers failed:", err.message);
      }
    };

    startRef.current = Date.now();
    pollLatestTriggers();
    pollingRef.current = window.setInterval(pollLatestTriggers, 3000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [fetchAllZoneWorkers, authHeader]);

  // ── Poll real DB status for affected workers every 5s
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (ev.zone && ev.zone !== "—") {
        pollRealStatus(ev.zone);
      }
    }, 5000);
    return () => window.clearInterval(iv);
  }, [ev.zone, pollRealStatus]);

  // ── Tick: advance AFFECTED worker stages every 500ms
  useEffect(() => {
    const tick = () => {
      setWorkers((prev) => {
        if (prev.length === 0) return prev;

        return prev.map((w) => {
          // Non-affected workers stay "completed" — no changes
          if (!w.is_affected) return w;

          // Already at terminal payout state — don't re-animate
          if (
            w.stage === "payout" &&
            (w.payout_status === "completed" || w.payout_status === "held" || w.payout_status === "failed")
          ) {
            return w;
          }

          const trigger = triggersRef.current.get(w.trigger_id);
          const triggerStartTime = trigger?.startTime || startRef.current;
          const elapsed = Date.now() - triggerStartTime;
          const st = stageAt(elapsed);

          const key = `${w.worker_id}`;

          // Use real DB fraud flag/score — never randomize
          const isFraud =
            w.fraud_flag === true
              ? true
              : typeof w.fraud_score === "number" && w.fraud_score > 0.5
                ? true
                : fraudMapRef.current.get(key) ?? false;

          if (!fraudMapRef.current.has(key) && st === "fraud") {
            fraudMapRef.current.set(key, isFraud);
          }

          const next = { ...w, stage: st };

          if (st === "verification") {
            next.verification_status = "pending";
            next.timeline = {
              ...next.timeline,
              verification:
                next.timeline.verification ??
                fmtTime(triggerStartTime + 2000),
            };
          }
          if (st === "fraud") {
            next.verification_status = "verified";
            next.fraud_status = fraudMapRef.current.get(key)
              ? "suspicious"
              : "clean";
            next.timeline = {
              ...next.timeline,
              verification:
                next.timeline.verification ??
                fmtTime(triggerStartTime + 2000),
              fraud:
                next.timeline.fraud ?? fmtTime(triggerStartTime + 4000),
            };
          }
          if (st === "payout") {
            const held = fraudMapRef.current.get(key) ? true : false;
            next.verification_status = "verified";
            next.fraud_status = held ? "suspicious" : "clean";

            if (
              w.real_payout_status &&
              w.real_payout_status !== "pending"
            ) {
              next.payout_status =
                w.real_payout_status === "paid" ||
                w.real_payout_status === "completed"
                  ? "completed"
                  : w.real_payout_status === "blocked" || w.fraud_flag
                    ? "held"
                    : "processing";
            } else {
              next.payout_status = held
                ? "held"
                : elapsed < 8000
                  ? "processing"
                  : "completed";
            }
            next.timeline = {
              ...next.timeline,
              verification:
                next.timeline.verification ??
                fmtTime(triggerStartTime + 2000),
              fraud:
                next.timeline.fraud ?? fmtTime(triggerStartTime + 4000),
              payout:
                next.timeline.payout ?? fmtTime(triggerStartTime + 6000),
            };
          }
          return next;
        });
      });
    };

    const iv = window.setInterval(tick, 500);
    return () => window.clearInterval(iv);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 text-[#111111]"
    >
      <div>
        <h1 className="font-display text-[24px] font-semibold tracking-tight text-[#111111]">
          Live Trigger Details
        </h1>
        <div className="mt-1 text-[12px] text-[#3A3A3A]">
          Trigger → Verification → Fraud Check → Payout
          {workers.filter((w) => w.is_affected).length > 0 && (
            <span className="ml-2 text-[#34D399]">
              · {workers.filter((w) => w.is_affected).length} workers processing
            </span>
          )}
          {ev.workers_triggered > 0 && (
            <span className="ml-2 text-[#4DA3FF]">
              · {ev.workers_triggered} triggered
            </span>
          )}
        </div>
      </div>

      <Panel
        title="TRIGGER CONTEXT"
        subtitle="selected trigger metadata"
        className="bg-[#FFFFFF] text-[#111111] border-[#E5E5E5]"
        headerClassName="border-b border-[#E5E5E5]"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#666666]">
              Trigger
            </div>
            <div className="mt-1 text-[#111111] truncate">{ev.id}</div>
          </div>
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#666666]">
              Timestamp
            </div>
            <div className="mt-1 text-[#111111] tabular-nums truncate">
              {ev.timestamp}
            </div>
          </div>
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#666666]">
              Zone
            </div>
            <div className="mt-1 text-[#111111] truncate">{ev.zone}</div>
          </div>
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#666666]">
              Type / Severity
            </div>
            <div className="mt-1 text-[#111111] truncate">
              {ev.trigger_type} · {ev.severity}
              {ev.workers_triggered > 0 && (
                <span className="ml-2 text-[#4DA3FF]">
                  · {ev.workers_triggered} workers
                </span>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="AFFECTED WORKERS"
        subtitle="real-time status per worker"
        className="bg-[#FFFFFF] text-[#111111] border-[#E5E5E5]"
        headerClassName="border-b border-[#E5E5E5]"
        bodyClassName="px-0 py-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#666666]">
                {["Worker ID", "Stage Progress", "Status", "Timestamp"].map(
                  (h) => (
                    <th key={h} className="px-5 py-3 border-b border-[#E5E5E5]">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-6 text-[#999999] text-[11px]"
                  >
                    No active simulation. Click &quot;Run Simulation&quot; in
                    Command Center to see workers.
                  </td>
                </tr>
              ) : (
                workers.map((w) => {
                  const stage = w.stage;
                  const triggerActive = stage === "trigger";
                  const verificationActive = stage === "verification";
                  const fraudActive = stage === "fraud";
                  const payoutActive = stage === "payout";

                  const currentStatus = payoutActive
                    ? w.payout_status
                    : fraudActive
                      ? w.fraud_status
                      : verificationActive
                        ? w.verification_status
                        : "triggered";

                  const currentStatusClass = payoutActive
                    ? statusColor(w.payout_status)
                    : w.fraud_status === "suspicious"
                      ? "text-[#FF4D4D]"
                      : fraudActive
                        ? "text-[#FFB020]"
                        : verificationActive
                          ? "text-[#FFB020]"
                          : "text-[#4DA3FF]";

                  const lastTs =
                    w.timeline.payout ??
                    w.timeline.fraud ??
                    w.timeline.verification ??
                    w.timeline.trigger;

                  const shouldNav =
                    w.is_affected &&
                    (w.payout_status === "held" ||
                      w.fraud_status === "suspicious");

                  return (
                    <tr
                      key={w.worker_id}
                      className="border-b border-[#E5E5E5] last:border-b-0 h-[56px]"
                      role={shouldNav ? "button" : undefined}
                      tabIndex={shouldNav ? 0 : -1}
                      onClick={() => {
                        if (!shouldNav) return;
                        const qp = new URLSearchParams({
                          trigger_id: ev.id,
                          zone: ev.zone,
                          trigger_type: ev.trigger_type,
                          severity: ev.severity,
                          payout_status: w.payout_status,
                        });
                        navigate(
                          `/admin/fraud/${encodeURIComponent(w.worker_id)}?${qp.toString()}`,
                        );
                      }}
                    >
                      <td className="px-5 py-3 text-[#111111] truncate">
                        {w.worker_id}
                        {!w.is_affected && (
                          <span className="ml-2 text-[10px] text-[#34D399]">
                            ✓
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <StageDot
                              active={triggerActive || !w.is_affected}
                              color="bg-[#4DA3FF]"
                            />
                            <StageLabel active={triggerActive}>
                              Trigger
                            </StageLabel>
                          </div>
                          <div className="h-[1px] w-6 bg-[#E5E5E5]" />
                          <div className="flex items-center gap-2">
                            <StageDot
                              active={verificationActive || !w.is_affected}
                              color="bg-[#FFB020]"
                            />
                            <StageLabel active={verificationActive}>
                              Verify
                            </StageLabel>
                          </div>
                          <div className="h-[1px] w-6 bg-[#E5E5E5]" />
                          <div className="flex items-center gap-2">
                            <StageDot
                              active={fraudActive || !w.is_affected}
                              color={
                                w.fraud_status === "suspicious"
                                  ? "bg-[#FF4D4D]"
                                  : "bg-[#FFB020]"
                              }
                            />
                            <StageLabel active={fraudActive}>Fraud</StageLabel>
                          </div>
                          <div className="h-[1px] w-6 bg-[#E5E5E5]" />
                          <div className="flex items-center gap-2">
                            <StageDot
                              active={payoutActive || !w.is_affected}
                              color={
                                w.payout_status === "completed" || !w.is_affected
                                  ? "bg-[#34D399]"
                                  : w.payout_status === "held"
                                    ? "bg-[#FF4D4D]"
                                    : "bg-[#4DA3FF]"
                              }
                            />
                            <StageLabel active={payoutActive}>
                              Payout
                            </StageLabel>
                          </div>
                        </div>

                        <div className="mt-1 grid grid-cols-4 gap-2 text-[10px] text-[#666666]">
                          <div className="truncate">{w.timeline.trigger}</div>
                          <div className="truncate">
                            {w.timeline.verification ?? "—"}
                          </div>
                          <div className="truncate">
                            {w.timeline.fraud ?? "—"}
                          </div>
                          <div className="truncate">
                            {w.timeline.payout ?? "—"}
                          </div>
                        </div>
                      </td>

                      <td
                        className={`px-5 py-3 truncate ${
                          !w.is_affected
                            ? "text-[#34D399]"
                            : currentStatusClass
                        }`}
                      >
                        {!w.is_affected ? "completed" : String(currentStatus)}
                      </td>
                      <td className="px-5 py-3 text-[#666666] tabular-nums truncate">
                        {lastTs}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </motion.div>
  );
}
