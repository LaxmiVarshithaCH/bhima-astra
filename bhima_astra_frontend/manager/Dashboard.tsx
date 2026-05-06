import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  MapPin,
  Users,
  DollarSign,
  AlertTriangle,
  Wifi,
  WifiOff,
  Bell,
  LogOut,
} from "lucide-react";
import ManagerZoneMap from "./ManagerZoneMap";
import { useManager } from "./src/context/ManagerContext";
import { getZoneWorkers, type WorkerInZone } from "./src/services/managerApi";

const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workerFeed, setWorkerFeed] = useState<WorkerInZone[]>([]);
  const [workerLoading, setWorkerLoading] = useState(false);

  // ── Context data ─────────────────────────────────────────────────────────
  const { profile, stats, zoneLiveData, zoneTriggers, loading } = useManager();

  // Derive primary zone from profile
  const primaryZone = profile?.assigned_zones?.[0] ?? "";
  const allZones = profile?.assigned_zones ?? [];

  // Zone live data for the primary zone
  const primaryLive = primaryZone ? (zoneLiveData[primaryZone] ?? null) : null;

  // Aggregate triggers across all assigned zones
  const allTriggers = allZones.flatMap((z) =>
    (zoneTriggers[z] ?? []).map((t) => ({ ...t, zone_id: z })),
  );

  // Derived stats with API fallback to zeros
  const dashStats = stats ?? {
    new_registrations: 0,
    payouts_processed: 0,
    flags_raised: 0,
    offline_workers_paid: 0,
    fraud_holds: 0,
    total_active_workers: 0,
    total_active_policies: 0,
  };

  const handleLogout = () => {
    localStorage.removeItem("managerLoggedIn");
    localStorage.removeItem("bhima_manager_token");
    localStorage.removeItem("bhima_manager_id");
    localStorage.removeItem("bhima_manager_name");
    localStorage.removeItem("bhima_manager_zones");
    navigate("/manager/login");
  };

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch workers for primary zone when profile is ready
  const fetchWorkers = useCallback(async () => {
    if (!primaryZone) return;
    setWorkerLoading(true);
    try {
      const data = await getZoneWorkers(primaryZone);
      setWorkerFeed(data.slice(0, 10)); // show top 10
    } catch {
      // keep empty feed
    } finally {
      setWorkerLoading(false);
    }
  }, [primaryZone]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const getScoreColor = (score: number): string => {
    if (score < 0.4) return "#7A9F8C";
    if (score < 0.65) return "#8B7355";
    return "#A55F4F";
  };

  const getRiskColor = (score: number): string => {
    if (score < 0.3) return "#7A9F8C";
    if (score < 0.7) return "#8B7355";
    return "#A55F4F";
  };

  const getPolicyColor = (status: string): string => {
    if (status === "active") return "#7A9F8C";
    if (status === "pending") return "#CDA955";
    return "#A55F4F";
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f8f8" }}>
      {/* Header Navigation */}
      <header
        className="bg-white"
        style={{ borderBottom: "1px solid #e8e8e8" }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <div
                className="w-10 h-10"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield className="w-6 h-6" style={{ color: "#ffffff" }} />
              </div>
              <div>
                <h1
                  className="font-display"
                  style={{
                    fontSize: "1.1875rem",
                    fontWeight: 700,
                    color: "#000000",
                  }}
                >
                  BHIMA ASTRA
                </h1>
                <p className="ui-label" style={{ color: "#666666" }}>
                  {profile?.manager_name ?? "Dark Store Manager"}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => navigate("/manager/dashboard")}
                className="ui-text font-medium transition-colors"
                style={{ color: "#000000", fontWeight: 600 }}
              >
                DASHBOARD
              </button>
              <button
                onClick={() => navigate("/manager/flag-disruption")}
                className="ui-text font-medium transition-colors"
                style={{ color: "#666666", fontWeight: 600 }}
              >
                FLAG DISRUPTION
              </button>
              <button
                onClick={() => navigate("/manager/workers")}
                className="ui-text font-medium transition-colors"
                style={{ color: "#666666", fontWeight: 600 }}
              >
                WORKERS
              </button>
              <button
                onClick={() => navigate("/manager/flag-history")}
                className="ui-text font-medium transition-colors"
                style={{ color: "#666666", fontWeight: 600 }}
              >
                FLAG HISTORY
              </button>
            </nav>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              <div className="ui-text">
                {currentTime.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="relative">
                <Bell
                  className="w-5 h-5"
                  style={{ color: "#666666", cursor: "pointer" }}
                />
                {primaryLive?.trigger_recommended && (
                  <div
                    className="absolute -top-1 -right-1 w-2 h-2"
                    style={{ backgroundColor: "#1a1a1a", borderRadius: "50%" }}
                  />
                )}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <LogOut className="w-5 h-5" style={{ color: "#666666" }} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page Header */}
      <div className="px-6 py-8">
        <div className="mb-8">
          <div className="ui-label mb-2">
            Dark Store Management · Live Overview
          </div>
          <h1
            className="font-display mb-4"
            style={{ fontSize: "2.6875rem", fontWeight: 700, color: "#000000" }}
          >
            {primaryZone
              ? `${primaryZone} Dark Store`
              : loading
                ? "Loading..."
                : "Manager Dashboard"}
          </h1>
          <p className="ui-text" style={{ color: "#666666" }}>
            Managing{" "}
            <span style={{ color: "#000000", fontWeight: 700 }}>
              {primaryLive?.worker_count ?? dashStats.total_active_workers}
            </span>{" "}
            workers · Zones:{" "}
            <span style={{ color: "#000000", fontWeight: 700 }}>
              {allZones.join(", ") || "—"}
            </span>
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-lg"
            style={{
              border: "1px solid #e8e8e8",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="ui-label">New Registrations</p>
                <p
                  className="ui-data"
                  style={{ fontSize: "1.6875rem", marginTop: "4px" }}
                >
                  {dashStats.new_registrations}
                </p>
              </div>
              <Users className="w-8 h-8" style={{ color: "#cccccc" }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-4 rounded-lg"
            style={{
              border: "1px solid #e8e8e8",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="ui-label">Payouts Processed</p>
                <p
                  className="ui-data"
                  style={{ fontSize: "1.6875rem", marginTop: "4px" }}
                >
                  ₹{dashStats.payouts_processed.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8" style={{ color: "#cccccc" }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-4 rounded-lg"
            style={{
              border: "1px solid #e8e8e8",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="ui-label">Flags Raised</p>
                <p
                  className="ui-data"
                  style={{ fontSize: "1.6875rem", marginTop: "4px" }}
                >
                  {dashStats.flags_raised}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8" style={{ color: "#cccccc" }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-4 rounded-lg"
            style={{
              border: "1px solid #e8e8e8",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="ui-label">Offline Workers Paid</p>
                <p
                  className="ui-data"
                  style={{ fontSize: "1.6875rem", marginTop: "4px" }}
                >
                  {dashStats.offline_workers_paid}
                </p>
              </div>
              <WifiOff className="w-8 h-8" style={{ color: "#cccccc" }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-4 rounded-lg"
            style={{
              border: "1px solid #e8e8e8",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="ui-label">Fraud Holds</p>
                <p
                  className="ui-data"
                  style={{ fontSize: "1.6875rem", marginTop: "4px" }}
                >
                  {dashStats.fraud_holds}
                </p>
              </div>
              <Shield className="w-8 h-8" style={{ color: "#cccccc" }} />
            </div>
          </motion.div>
        </div>

        {/* Zone Overview */}
        <div className="mb-8">
          <h2
            className="font-display mb-4"
            style={{ fontSize: "1.6875rem", fontWeight: 700, color: "#000000" }}
          >
            Zone Overview
          </h2>
          {allZones.length === 0 && loading ? (
            <div
              className="p-6 rounded-lg bg-white"
              style={{ border: "1px solid #e8e8e8" }}
            >
              <p className="ui-label" style={{ color: "#999999" }}>
                Loading zone data...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allZones.map((zone) => {
                const liveData = zoneLiveData[zone] ?? null;
                const score = liveData?.zone_risk_score ?? 0;
                const workerCount = liveData?.worker_count ?? 0;
                const triggerCount = liveData?.disruption_events ?? 0;
                const flagCount = liveData?.manager_flags ?? 0;
                return (
                  <motion.div
                    key={zone}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-lg cursor-pointer transition-colors"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ui-data" style={{ fontSize: "1.3125rem" }}>
                        {zone}
                      </h3>
                      <MapPin
                        className="w-5 h-5"
                        style={{ color: "#999999" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="ui-label">Workers</p>
                        <p
                          className="ui-data"
                          style={{
                            fontSize: "1.4375rem",
                            marginTop: "4px",
                            fontWeight: 700,
                          }}
                        >
                          {workerCount}
                        </p>
                      </div>
                      <div>
                        <p className="ui-label">Risk Score</p>
                        <p
                          className="ui-data"
                          style={{
                            fontSize: "1.4375rem",
                            marginTop: "4px",
                            fontWeight: 700,
                            color: getScoreColor(score),
                          }}
                        >
                          {(score * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="ui-label">Composite Score</p>
                        <span
                          className="ui-label"
                          style={{ color: getScoreColor(score) }}
                        >
                          {score < 0.4
                            ? "LOW"
                            : score < 0.65
                              ? "MEDIUM"
                              : "HIGH"}
                        </span>
                      </div>
                      <div
                        className="w-full h-2"
                        style={{
                          backgroundColor: "#e8e8e8",
                          borderRadius: "9999px",
                        }}
                      >
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${score * 100}%`,
                            backgroundColor: getScoreColor(score),
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ui-text">
                        <span style={{ color: "#666666" }}>
                          Disruption Events:
                        </span>
                        <span style={{ color: "#000000" }}>{triggerCount}</span>
                      </div>
                      <div className="flex items-center justify-between ui-text">
                        <span style={{ color: "#666666" }}>Pending Flags:</span>
                        <span style={{ color: "#000000" }}>{flagCount}</span>
                      </div>
                      <div className="flex items-center justify-between ui-text">
                        <span style={{ color: "#666666" }}>
                          Trigger Active:
                        </span>
                        <span
                          style={{
                            color: liveData?.trigger_recommended
                              ? "#A55F4F"
                              : "#7A9F8C",
                          }}
                        >
                          {liveData?.trigger_recommended ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Zone Map and Trigger Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Live Zone Map */}
          <ManagerZoneMap />

          {/* Trigger Events */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-lg"
            style={{
              border: "1px solid #e8e8e8",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              className="font-display mb-4"
              style={{
                fontSize: "1.6875rem",
                fontWeight: 700,
                color: "#000000",
              }}
            >
              Recent Trigger Events
            </h2>
            <div className="space-y-4">
              {allTriggers.length === 0 ? (
                <p
                  className="ui-text"
                  style={{
                    color: "#999999",
                    textAlign: "center",
                    padding: "24px 0",
                  }}
                >
                  {loading
                    ? "Loading trigger events..."
                    : "No recent trigger events"}
                </p>
              ) : (
                allTriggers.map((trigger) => (
                  <div
                    key={`${trigger.claim_id}-${trigger.zone_id}`}
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="font-display"
                        style={{
                          fontSize: "1.125rem",
                          fontWeight: 700,
                          color: "#000000",
                        }}
                      >
                        {(trigger.trigger_type ?? "UNKNOWN").toUpperCase()}
                      </span>
                      <span
                        className="ui-label px-3 py-1 rounded"
                        style={{ backgroundColor: "#A55F4F", color: "#ffffff" }}
                      >
                        {trigger.trigger_level ?? "—"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 ui-text">
                      <div>
                        <span style={{ color: "#666666" }}>Zone:</span>
                        <span
                          style={{
                            color: "#000000",
                            marginLeft: "8px",
                            fontWeight: 600,
                          }}
                        >
                          {trigger.zone_id}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Workers:</span>
                        <span
                          style={{
                            color: "#000000",
                            marginLeft: "8px",
                            fontWeight: 600,
                          }}
                        >
                          {trigger.workers_affected}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Total Payout:</span>
                        <span
                          style={{
                            color: "#7A9F8C",
                            marginLeft: "8px",
                            fontWeight: 600,
                          }}
                        >
                          ₹{trigger.total_payout.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Fraud Holds:</span>
                        <span
                          style={{
                            color: "#A55F4F",
                            marginLeft: "8px",
                            fontWeight: 600,
                          }}
                        >
                          {trigger.fraud_holds}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Time:</span>
                        <span
                          style={{
                            color: "#000000",
                            marginLeft: "8px",
                            fontWeight: 600,
                          }}
                        >
                          {trigger.fired_at
                            ? new Date(trigger.fired_at).toLocaleTimeString()
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Status:</span>
                        <span
                          style={{
                            color: "#000000",
                            marginLeft: "8px",
                            fontWeight: 600,
                          }}
                        >
                          {trigger.payout_status ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Worker Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-lg"
          style={{
            border: "1px solid #e8e8e8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h2
            className="font-display mb-4"
            style={{ fontSize: "1.6875rem", fontWeight: 700, color: "#000000" }}
          >
            Worker Activity Feed
          </h2>
          <div className="space-y-4">
            {workerLoading ? (
              <p
                className="ui-text"
                style={{
                  color: "#999999",
                  textAlign: "center",
                  padding: "24px 0",
                }}
              >
                Loading workers...
              </p>
            ) : workerFeed.length === 0 ? (
              <p
                className="ui-text"
                style={{
                  color: "#999999",
                  textAlign: "center",
                  padding: "24px 0",
                }}
              >
                No workers found in assigned zones.
              </p>
            ) : (
              workerFeed.map((worker) => {
                const riskScore = worker.fraud_risk_score ?? 0;
                return (
                  <div
                    key={worker.worker_id}
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: worker.kyc_verified
                              ? "#7A9F8C"
                              : "#cccccc",
                          }}
                        />
                        <div>
                          <p className="ui-data">{worker.worker_name ?? "—"}</p>
                          <p
                            className="ui-text"
                            style={{ color: "#666666", marginTop: "2px" }}
                          >
                            ID: {worker.worker_id} · {worker.geo_zone_id} ·{" "}
                            {worker.platform ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          {worker.kyc_verified ? (
                            <Wifi
                              className="w-4 h-4"
                              style={{ color: "#7A9F8C" }}
                            />
                          ) : (
                            <WifiOff
                              className="w-4 h-4"
                              style={{ color: "#cccccc" }}
                            />
                          )}
                          <span
                            className="ui-label"
                            style={{
                              color: worker.kyc_verified
                                ? "#7A9F8C"
                                : "#999999",
                            }}
                          >
                            {worker.kyc_verified ? "KYC OK" : "KYC PENDING"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-4 ui-text">
                      <div>
                        <span style={{ color: "#666666" }}>Vehicle:</span>
                        <span
                          style={{
                            color: "#000000",
                            marginLeft: "4px",
                            fontWeight: 600,
                          }}
                        >
                          {worker.vehicle_type ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Plan:</span>
                        <span
                          style={{
                            color: "#000000",
                            marginLeft: "4px",
                            fontWeight: 600,
                          }}
                        >
                          {worker.plan_tier ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Risk Score:</span>
                        <span
                          style={{
                            color: getRiskColor(riskScore),
                            marginLeft: "4px",
                            fontWeight: 600,
                          }}
                        >
                          {(riskScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#666666" }}>Policy:</span>
                        <span
                          style={{
                            color: getPolicyColor(worker.policy_status ?? ""),
                            marginLeft: "4px",
                            fontWeight: 600,
                          }}
                        >
                          {worker.policy_status ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
