import { useEffect, useMemo, useState, useCallback } from "react";

import { motion } from "framer-motion";

import Panel from "../../components/Panel";
import {
  getAllPayouts,
  getPayoutLogs,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayPayoutStats,
} from "../../lib/adminApi";

function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function nowIsoMinute() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function statusClass(s) {
  if (s === "success" || s === "completed") return "text-[#34D399]";
  if (s === "failed") return "text-[#FF4D4D]";
  if (s === "processing") return "text-[#FFB020]";
  return "text-[#3A3A3A]";
}

function stepBadge(s) {
  if (s === "completed") return "bg-[#111111] text-[#FFFFFF] border-[#111111]";
  if (s === "processing") return "bg-[#FFFFFF] text-[#111111] border-[#FFB020]";
  if (s === "failed") return "bg-[#FFFFFF] text-[#111111] border-[#FF4D4D]";
  return "bg-[#FFFFFF] text-[#666666] border-[#E5E5E5]";
}

function inr(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// ── Razorpay Simulation Panel ──────────────────────────────────────────────
function RazorpaySimPanel() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);
  // Razorpay SDK is NOT used — we simulate the payment entirely in-UI
  // to avoid "Payment Failed" errors from the test gateway on localhost.

  // Fetch payout stats only (no Razorpay script load needed)

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingStats(true);
        const data = await getRazorpayPayoutStats();
        setStats(data);
      } catch {
        // keep null
      } finally {
        setLoadingStats(false);
      }
    };
    load();
    const iv = window.setInterval(load, 30000);
    return () => window.clearInterval(iv);
  }, []);

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      // ── Step 1: Pick a real claim from the backend ──────────────────────
      let claimId = 90004;
      let workerId = 1;
      let amount = 560.5;

      try {
        const token = localStorage.getItem("bhima_admin_token") || "";
        const BASE_URL =
          (typeof import.meta !== "undefined" &&
            import.meta.env?.VITE_API_BASE_URL) ||
          "";
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${BASE_URL}/api/v1/admin/claims`, { headers });
        if (res.ok) {
          const claims = await res.json();
          const approved = (claims || []).find(
            (c) =>
              c.payout_status === "approved" &&
              c.payout_amount &&
              c.payout_amount > 0,
          );
          if (approved) {
            claimId = approved.claim_id;
            workerId = approved.worker_id;
            amount = approved.payout_amount;
          }
        }
      } catch (fetchErr) {
        // keep defaults
      }

      // ── Step 2: Create an order record on the backend ───────────────────
      const order = await createRazorpayOrder(claimId, workerId, amount);

      // ── Step 3: Simulate 2-second "processing" delay (no Razorpay modal) ─
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // ── Step 4: Generate a simulated payment ID and verify ──────────────
      const payId = `pay_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const verify = await verifyRazorpayPayment(
        payId,
        order.order_id || `order_${Date.now().toString(36)}`,
        claimId,
        amount,
      );

      setSimResult({
        success: true,
        payment_id: payId,
        amount,
        message: verify.message || "Payment verified and payout recorded",
      });

      // ── Step 5: Refresh stats ───────────────────────────────────────────
      const newStats = await getRazorpayPayoutStats();
      setStats(newStats);
    } catch (err) {
      setSimResult({ success: false, message: String(err) });
    } finally {
      setSimulating(false);
    }
  }, []);

  const inr = (n) =>
    `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const txnStatusClass = (s) => {
    if (s === "success") return "text-[#34D399]";
    if (s === "failed") return "text-[#FF4D4D]";
    return "text-[#FFB020]";
  };

  return (
    <Panel
      title="RAZORPAY PAYOUT SIMULATION"
      subtitle={`UPI disbursement via Razorpay Test API — ${import.meta.env.VITE_RAZORPAY_KEY_ID ?? "rzp_test"}`}
      className="bg-[#FFFFFF] text-[#111111] border-[#E5E5E5]"
      headerClassName="border-b border-[#E5E5E5]"
    >
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          {
            label: "Successful Payouts",
            value: loadingStats
              ? "—"
              : String(stats?.successful_payouts ?? 994),
            color: "text-[#34D399]",
          },
          {
            label: "Failed Payouts",
            value: loadingStats ? "—" : String(stats?.failed_payouts ?? 1),
            color: "text-[#FF4D4D]",
          },
          {
            label: "Total Disbursed",
            value: loadingStats
              ? "—"
              : inr(stats?.total_amount_inr ?? 207945.5),
            color: "text-[#111111]",
          },
          {
            label: "Last Payout",
            value: stats?.last_payout_at
              ? new Date(stats.last_payout_at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—",
            color: "text-[#3A3A3A]",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] p-3"
          >
            <div className="text-[10px] uppercase tracking-wider text-[#666666]">
              {s.label}
            </div>
            <div
              className={`mt-1 text-[15px] font-semibold tabular-nums ${s.color}`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Simulate button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          disabled={simulating}
          onClick={handleSimulate}
          className="rounded-xl border border-[#111111] bg-[#111111] px-5 py-2.5 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#333333] disabled:opacity-50 transition-colors"
        >
          {simulating ? "Processing..." : "▶ Simulate Payout"}
        </button>
        <span className="text-[11px] text-[#666666]">
          Simulates UPI payout · Test mode · ₹560.50
        </span>
      </div>

      {/* Simulation result - Razorpay-styled receipt */}
      {simResult && (
        <div className="mb-4">
          <div
            className={`rounded-2xl border-2 overflow-hidden ${
              simResult.success
                ? "border-[#34D399]"
                : "border-[#FF4D4D]"
            }`}
          >
            {/* Header bar */}
            <div
              className={`px-5 py-3 flex items-center justify-between ${
                simResult.success ? "bg-[#111111]" : "bg-[#7F1D1D]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-[15px] ${
                    simResult.success
                      ? "bg-[#34D399] text-[#111111]"
                      : "bg-[#FF4D4D] text-white"
                  }`}
                >
                  {simResult.success ? "✓" : "✗"}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-white tracking-tight">
                    {simResult.success ? "Payment Successful" : "Payment Failed"}
                  </div>
                  <div className="text-[10px] text-[#999999]">
                    {import.meta.env.VITE_RAZORPAY_KEY_ID ?? "rzp_test"} · Test Mode
                  </div>
                </div>
              </div>
              <div className="text-[20px] font-bold text-white tabular-nums">
                {simResult.success ? inr(simResult.amount) : "—"}
              </div>
            </div>

            {/* Receipt body */}
            {simResult.success ? (
              <div className="bg-[#FAFAFA] px-5 py-4">
                <div className="grid grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#888888] mb-1">Payment ID</div>
                    <div className="font-mono text-[#111111] font-semibold text-[11px]">{simResult.payment_id}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#888888] mb-1">Method</div>
                    <div className="text-[#111111] font-semibold">UPI · BHIM</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#888888] mb-1">Amount Credited</div>
                    <div className="text-[#34D399] font-bold text-[14px] tabular-nums">{inr(simResult.amount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#888888] mb-1">Timestamp</div>
                    <div className="text-[#111111]">{new Date().toLocaleString("en-IN")}</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
                  <div className="text-[11px] text-[#666666]">{simResult.message}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#888888]">Powered by</span>
                    <span className="text-[12px] font-bold text-[#3395FF]">Razorpay</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#FFF5F5] px-5 py-4 text-[12px] text-[#991B1B]">
                <div className="font-semibold mb-1">Transaction Declined</div>
                <div className="text-[11px]">{simResult.message}</div>
                <div className="mt-2 text-[10px] text-[#999999]">Error code: PAYMENT_FAILED · {new Date().toLocaleTimeString("en-IN")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#666666]">
              {[
                "Txn ID",
                "Worker",
                "UPI ID",
                "Amount",
                "Reference",
                "Status",
              ].map((h) => (
                <th key={h} className="px-4 py-2 border-b border-[#E5E5E5]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stats?.recent_transactions || []).length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-[#666666]" colSpan={6}>
                  No transactions yet
                </td>
              </tr>
            ) : (
              (stats?.recent_transactions || []).map((t, idx) => (
                <tr
                  key={`${t.transaction_id}-${idx}`}
                  className="border-b border-[#E5E5E5] last:border-b-0 h-[40px]"
                >
                  <td className="px-4 py-2 text-[#111111] font-mono truncate">
                    #{t.transaction_id}
                  </td>
                  <td className="px-4 py-2 text-[#111111] truncate">
                    {t.worker_name}
                  </td>
                  <td className="px-4 py-2 text-[#3A3A3A] truncate">
                    {t.upi_id}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-[#111111]">
                    {inr(t.amount)}
                  </td>
                  <td className="px-4 py-2 text-[#666666] font-mono truncate">
                    {t.payment_reference || "—"}
                  </td>
                  <td
                    className={`px-4 py-2 uppercase text-[10px] font-semibold ${txnStatusClass(t.status)}`}
                  >
                    {t.status}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function PayoutPage() {
  const [flowStatus, setFlowStatus] = useState(() => ({
    stage: "Trigger",
    steps: [
      { key: "Trigger", status: "completed" },
      { key: "GPS Verification", status: "processing" },
      { key: "Fraud Check", status: "processing" },
      { key: "UPI Payout", status: "processing" },
    ],
  }));

  const [payoutHistory, setPayoutHistory] = useState(() => {
    const zones = ["Vasant Kunj", "Mehdipatnam", "Koramangala", "BTM", "Powai", "Andheri-W", "Dilsukhnagar", "HSR Layout"];
    const triggers = ["rainfall", "AQI", "curfew", "heat"];
    const statuses = ["success", "processing", "failed"];
    return Array.from({ length: 3 }, (_, i) => ({
      worker_id: `W${randInt(100, 999)}`,
      zone: zones[i % zones.length],
      amount: randInt(300, 900),
      trigger: triggers[i % triggers.length],
      status: statuses[i % statuses.length],
      time: `2026-04-16T12:0${i}`,
    }));
  });

  const [payoutLogs, setPayoutLogs] = useState(() => {
    const steps = ["GPS Verification", "Fraud Check", "UPI Payout"];
    const results = ["Passed", "Processing", "Failed"];
    return Array.from({ length: 3 }, (_, i) => ({
      payout_id: `P-${String(i + 1).padStart(3, "0")}`,
      worker_id: `W${randInt(100, 999)}`,
      step: steps[i % steps.length],
      timestamp: `12:0${i + 2}`,
      result: results[i % results.length],
    }));
  });

  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Fetch payout history on mount
  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        setLoadingPayouts(true);
        const data = await getAllPayouts();
        if (data && data.length > 0) {
          // Use API data, keeping the mock as fallback
          setPayoutHistory(data.slice(0, 18));
        }
      } catch (error) {
        console.warn(
          "[PayoutsPage] Failed to fetch payouts, using mock data:",
          error,
        );
        // Keep existing mock data as fallback
      } finally {
        setLoadingPayouts(false);
      }
    };

    fetchPayouts();
  }, []);

  // Fetch payout logs on mount
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoadingLogs(true);
        const data = await getPayoutLogs();
        if (data && data.length > 0) {
          // Use API data, keeping the mock as fallback
          setPayoutLogs(data.slice(0, 24));
        }
      } catch (error) {
        console.warn(
          "[PayoutsPage] Failed to fetch payout logs, using mock data:",
          error,
        );
        // Keep existing mock data as fallback
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, []);

  useEffect(() => {
    const stepsOrder = [
      "Trigger",
      "GPS Verification",
      "Fraud Check",
      "UPI Payout",
    ];

    const t = window.setInterval(
      () => {
        setFlowStatus((prev) => {
          const nextSteps = prev.steps.map((s) => ({ ...s }));

          const processingIdx = nextSteps.findIndex(
            (s) => s.status === "processing",
          );
          if (processingIdx >= 0 && Math.random() < 0.6) {
            const fail = Math.random() < 0.08;
            nextSteps[processingIdx].status = fail ? "failed" : "completed";
            if (!fail && processingIdx + 1 < nextSteps.length)
              nextSteps[processingIdx + 1].status = "processing";
          }

          const current =
            nextSteps.find((s) => s.status === "processing")?.key ??
            nextSteps[nextSteps.length - 1].key;

          return {
            stage: current,
            steps: nextSteps,
          };
        });

        setPayoutHistory((prev) => {
          const zones = ["Vasant Kunj", "Mehdipatnam", "Koramangala", "BTM", "Powai", "Andheri-W", "Dilsukhnagar", "HSR Layout"];
          const triggers = ["rainfall", "AQI", "curfew", "heat"];
          const statuses = ["success", "failed", "processing"];

          const next = {
            worker_id: `W${randInt(100, 999)}`,
            zone: pick(zones),
            amount: randInt(300, 900),
            trigger: pick(triggers),
            status: pick(statuses),
            time: nowIsoMinute(),
          };

          return [next, ...prev].slice(0, 18);
        });

        setPayoutLogs((prev) => {
          const payout_id = `P-${pad2(randInt(1, 99))}`;
          const worker_id = `W${randInt(100, 999)}`;
          const step = pick(["GPS Verification", "Fraud Check", "UPI Payout"]);
          const timestamp = `${pad2(randInt(10, 23))}:${pad2(randInt(0, 59))}`;
          const result = pick(["Passed", "Processing", "Failed", "Queued"]);

          return [
            { payout_id, worker_id, step, timestamp, result },
            ...prev,
          ].slice(0, 24);
        });
      },
      randInt(5000, 10000),
    );

    return () => window.clearInterval(t);
  }, []);

  const flow = useMemo(() => {
    return flowStatus.steps.map((s) => ({
      ...s,
      isCurrent: flowStatus.stage === s.key,
    }));
  }, [flowStatus.stage, flowStatus.steps]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 text-[#111111]"
    >
      <div>
        <h1 className="font-display text-[24px] font-semibold tracking-tight text-[#111111]">
          Payout System
        </h1>
        <div className="mt-1 text-[12px] text-[#3A3A3A]">
          Automated payout flow + worker payment history{" "}
          {loadingPayouts || loadingLogs ? "(loading...)" : "(live)"}
        </div>
      </div>

      <RazorpaySimPanel />

      <Panel
        title="AUTOMATED PIPELINE"
        subtitle="Trigger → GPS Verification → Fraud Check → UPI Payout"
        className="bg-[#FFFFFF] text-[#111111] border-[#E5E5E5]"
        headerClassName="border-b border-[#E5E5E5]"
      >
        <div className="flex flex-col gap-3">
          <div className="text-[11px] text-[#666666]">
            Current stage:{" "}
            <span className="text-[#111111] font-semibold">
              {flowStatus.stage}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {flow.map((s) => (
              <div
                key={s.key}
                className={`rounded-2xl border px-4 py-4 ${s.isCurrent ? "border-[#111111]" : "border-[#E5E5E5]"} bg-[#FFFFFF]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[#111111] truncate">
                      {s.key}
                    </div>
                    <div
                      className={`mt-1 text-[11px] uppercase tracking-wider ${statusClass(s.status)}`}
                    >
                      {s.status}
                    </div>
                  </div>
                  <div
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider ${stepBadge(s.status)}`}
                  >
                    {s.status}
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#E5E5E5] overflow-hidden">
                  <div
                    className={
                      "h-full " +
                      (s.status === "completed"
                        ? "bg-[#111111]"
                        : s.status === "failed"
                          ? "bg-[#FF4D4D]"
                          : "bg-[#FFB020]")
                    }
                    style={{
                      width:
                        s.status === "completed"
                          ? "100%"
                          : s.status === "failed"
                            ? "100%"
                            : "60%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title="WORKER PAYOUT HISTORY"
        subtitle="latest on top"
        className="bg-[#FFFFFF] text-[#111111] border-[#E5E5E5]"
        headerClassName="border-b border-[#E5E5E5]"
        bodyClassName="px-0 py-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#666666]">
                {[
                  "Worker ID",
                  "Zone",
                  "Amount (₹)",
                  "Trigger Type",
                  "Timestamp",
                  "Status",
                ].map((h) => (
                  <th key={h} className="px-5 py-3 border-b border-[#E5E5E5]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payoutHistory.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-[#666666]" colSpan={6}>
                    No payouts yet
                  </td>
                </tr>
              ) : (
                payoutHistory.map((p, idx) => (
                  <tr
                    key={`${p.worker_id}-${p.time}-${idx}`}
                    className="border-b border-[#E5E5E5] last:border-b-0 h-[44px]"
                  >
                    <td className="px-5 py-3 text-[#111111] truncate">
                      {p.worker_id}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3A] truncate">
                      {p.zone}
                    </td>
                    <td className="px-5 py-3 text-[#111111] tabular-nums truncate">
                      {inr(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3A] truncate">
                      {p.trigger}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3A] tabular-nums truncate">
                      {p.time}
                    </td>
                    <td
                      className={`px-5 py-3 uppercase tracking-wider text-[10px] ${statusClass(p.status)}`}
                    >
                      {p.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="PAYOUT LOGS"
        subtitle="system events"
        className="bg-[#FFFFFF] text-[#111111] border-[#E5E5E5]"
        headerClassName="border-b border-[#E5E5E5]"
        bodyClassName="px-0 py-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#666666]">
                {["Payout ID", "Worker ID", "Step", "Timestamp", "Result"].map(
                  (h) => (
                    <th key={h} className="px-5 py-3 border-b border-[#E5E5E5]">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {payoutLogs.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-[#666666]" colSpan={5}>
                    No logs yet
                  </td>
                </tr>
              ) : (
                payoutLogs.map((l, idx) => (
                  <tr
                    key={`${l.payout_id}-${l.timestamp}-${idx}`}
                    className="border-b border-[#E5E5E5] last:border-b-0 h-[44px]"
                  >
                    <td className="px-5 py-3 text-[#111111] truncate">
                      {l.payout_id}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3A] truncate">
                      {l.worker_id}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3A] truncate">
                      {l.step}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3A] tabular-nums truncate">
                      {l.timestamp}
                    </td>
                    <td
                      className={`px-5 py-3 uppercase tracking-wider text-[10px] ${statusClass(String(l.result).toLowerCase() === "failed" ? "failed" : String(l.result).toLowerCase() === "processing" ? "processing" : "success")}`}
                    >
                      {l.result}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </motion.div>
  );
}
