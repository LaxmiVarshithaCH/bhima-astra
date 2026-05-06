import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  Users,
  Search,
  Wifi,
  WifiOff,
  TrendingUp,
  Shield,
  ArrowLeft,
  Download,
  Eye,
  UserCheck,
  X,
  Clock,
  MapPin,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";

import { useManager } from "./src/context/ManagerContext";
import { getZoneWorkers } from "./src/services/managerApi";

interface Worker {
  id: number;
  worker_name: string;
  worker_id: number;
  platform: string;
  vehicle_type: string;
  status: "online" | "offline";
  income_today: number;
  orders_today: number;
  fraud_risk_score: number;
  policy_status: "active" | "expired" | "pending" | "none";
  zone_id: string;
  days_since_active: number;
  kyc_status: "verified" | "pending" | "flagged";
}

const Workers: React.FC = () => {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "offline"
  >("all");
  const [riskFilter, setRiskFilter] = useState<
    "all" | "low" | "medium" | "high"
  >("all");
  const [selectedWorkers, setSelectedWorkers] = useState<number[]>([]);
  const [selectedWorkerDetails, setSelectedWorkerDetails] =
    useState<Worker | null>(null);

  const { profile } = useManager();

  // Map API WorkerInZone to local Worker interface
  const mapApiWorker = (
    w: {
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
    },
    idx: number,
  ): Worker => {
    const score = w.fraud_risk_score ?? 0;
    const kyc = w.kyc_verified;
    return {
      id: idx + 1,
      worker_name: w.worker_name ?? "Unknown",
      worker_id: w.worker_id,
      platform: w.platform ?? "—",
      vehicle_type: w.vehicle_type ?? "—",
      status: (kyc ? "online" : "offline") as "online" | "offline",
      income_today: w.income_today ?? 0,
      orders_today: w.orders_today ?? 0,
      fraud_risk_score: score,
      policy_status: (w.policy_status ?? "none") as
        | "active"
        | "expired"
        | "pending"
        | "none",
      zone_id: w.geo_zone_id ?? "—",
      days_since_active: 0,
      kyc_status: (kyc
        ? "verified"
        : w.payment_verified_status === "flagged"
          ? "flagged"
          : "pending") as "verified" | "pending" | "flagged",
    };
  };

  const fetchWorkers = useCallback(async () => {
    const zones = profile?.assigned_zones ?? [];
    if (zones.length === 0) return;
    setLoading(true);
    try {
      const allResults = await Promise.allSettled(
        zones.map((z) => getZoneWorkers(z)),
      );
      const combined: Worker[] = [];
      allResults.forEach((res) => {
        if (res.status === "fulfilled") {
          res.value.forEach((w, i) =>
            combined.push(mapApiWorker(w, combined.length + i)),
          );
        }
      });
      setWorkers(combined);
      setFilteredWorkers(combined);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [profile?.assigned_zones?.join(",")]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // Filter workers
  useEffect(() => {
    let filtered = workers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (worker) =>
          worker.worker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.worker_id.toString().includes(searchTerm) ||
          worker.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.zone_id.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((worker) => worker.status === statusFilter);
    }

    // Risk filter
    if (riskFilter !== "all") {
      filtered = filtered.filter((worker) => {
        const score = worker.fraud_risk_score;
        if (riskFilter === "low") return score < 0.3;
        if (riskFilter === "medium") return score >= 0.3 && score < 0.7;
        if (riskFilter === "high") return score >= 0.7;
        return true;
      });
    }

    setFilteredWorkers(filtered);
  }, [workers, searchTerm, statusFilter, riskFilter]);

  const getRiskLabel = (score: number): string => {
    if (score < 0.3) return "LOW";
    if (score < 0.7) return "MEDIUM";
    return "HIGH";
  };

  const getRiskColor = (score: number): string => {
    if (score < 0.3) return "#7A9F8C"; // Matte green
    if (score < 0.7) return "#8B7355"; // Matte tan
    return "#A55F4F"; // Matte red
  };

  const getStatusIndicatorColor = (status: string): string => {
    return status === "online" ? "#7A9F8C" : "#999999";
  };

  const getPolicyColor = (status: string): string => {
    if (status === "active") return "#7A9F8C"; // Matte green
    if (status === "pending") return "#CDA955"; // Matte yellow
    return "#A55F4F"; // Matte red
  };

  const getKycColor = (status: string): string => {
    if (status === "verified") return "#7A9F8C"; // Matte green
    if (status === "pending") return "#CDA955"; // Matte yellow
    return "#A55F4F"; // Matte red
  };

  const handleBulkPayoutRequest = () => {
    if (selectedWorkers.length === 0) return;
    console.log("Requesting bulk payout for workers:", selectedWorkers);
    // Navigate to flag disruption with pre-selected workers
    navigate("/manager/flag-disruption");
  };

  const handleDownload = () => {
    if (filteredWorkers.length === 0) {
      console.warn("No workers to download");
      return;
    }

    // Create CSV header
    const headers = [
      "Worker Name",
      "ID",
      "Platform",
      "Status",
      "Income Today",
      "Orders",
      "Risk Score",
      "Policy",
      "Zone",
      "KYC Status",
    ];

    // Create CSV rows
    const rows = filteredWorkers.map((worker) => [
      worker.worker_name,
      worker.worker_id,
      worker.platform,
      worker.status,
      worker.income_today,
      worker.orders_today,
      worker.fraud_risk_score.toFixed(2),
      worker.policy_status,
      worker.zone_id,
      worker.kyc_status,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `workers-list-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f8f8" }}>
      {/* Header */}
      <header
        className="bg-white"
        style={{ borderBottom: "1px solid #e8e8e8" }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={() => navigate("/manager/dashboard")}
                className="ui-text transition-colors"
                whileHover={{ x: -5 }}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                BACK TO DASHBOARD
              </motion.button>
              <div
                className="w-8 h-8"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users className="w-5 h-5" style={{ color: "#ffffff" }} />
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
                  Worker Directory
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <motion.button
                onClick={handleBulkPayoutRequest}
                disabled={selectedWorkers.length === 0}
                className="px-4 py-2 font-medium rounded-lg text-sm"
                whileHover={{ scale: selectedWorkers.length > 0 ? 1.02 : 1 }}
                whileTap={{ scale: selectedWorkers.length > 0 ? 0.98 : 1 }}
                style={{
                  backgroundColor: "#1a1a1a",
                  color: "#ffffff",
                  opacity: selectedWorkers.length === 0 ? 0.5 : 1,
                  cursor:
                    selectedWorkers.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                REQUEST PAYOUT ({selectedWorkers.length})
              </motion.button>
              <button
                onClick={handleDownload}
                className="text-gray-600 hover:text-gray-900"
                title="Download workers list as CSV"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="mb-8">
          <div className="ui-label mb-2">Worker Directory</div>
          <h1
            className="font-display mb-4"
            style={{ fontSize: "1.9375rem", color: "#000000" }}
          >
            Workers in Dark Store
          </h1>
          <p className="ui-text" style={{ color: "#666666" }}>
            Search and filter workers by status, risk level, platform, and zone
          </p>
        </div>

        {/* Filters */}
        <div
          className="bg-white p-6 rounded-lg mb-6"
          style={{
            border: "1px solid #e8e8e8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block ui-label mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, ID, Platform, Zone..."
                  className="w-full pl-10 pr-4 py-2 bg-white rounded-lg focus:outline-none font-medium ui-text"
                  style={{ border: "1px solid #e8e8e8", color: "#333333" }}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block ui-label mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "online" | "offline",
                  )
                }
                className="w-full px-4 py-2 bg-white rounded-lg focus:outline-none font-medium ui-text"
                style={{ border: "1px solid #e8e8e8", color: "#333333" }}
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* Risk Filter */}
            <div>
              <label className="block ui-label mb-2">Risk Level</label>
              <select
                value={riskFilter}
                onChange={(e) =>
                  setRiskFilter(
                    e.target.value as "all" | "low" | "medium" | "high",
                  )
                }
                className="w-full px-4 py-2 bg-white rounded-lg focus:outline-none font-medium ui-text"
                style={{ border: "1px solid #e8e8e8", color: "#333333" }}
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low (&lt;30%)</option>
                <option value="medium">Medium (30-70%)</option>
                <option value="high">High (&gt;70%)</option>
              </select>
            </div>

            {/* Results Count */}
            <div>
              <label className="block ui-label mb-2">Results</label>
              <div
                className="px-4 py-2 bg-white rounded-lg"
                style={{ border: "1px solid #e8e8e8" }}
              >
                <span className="ui-data">
                  {filteredWorkers.length} workers
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Worker Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredWorkers.map((worker) => (
            <motion.div
              key={worker.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: worker.id * 0.05 }}
              className="bg-white p-4 rounded-lg"
              style={{
                border: "1px solid #e8e8e8",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: getStatusIndicatorColor(worker.status),
                    }}
                  ></div>
                  <div>
                    <p className="ui-data">{worker.worker_name}</p>
                    <p
                      className="ui-text"
                      style={{ color: "#666666", marginTop: 2 }}
                    >
                      ID: {worker.worker_id} · {worker.zone_id}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    {worker.status === "online" ? (
                      <Wifi
                        className="w-4 h-4"
                        style={{
                          color: getStatusIndicatorColor(worker.status),
                        }}
                      />
                    ) : (
                      <WifiOff
                        className="w-4 h-4"
                        style={{
                          color: getStatusIndicatorColor(worker.status),
                        }}
                      />
                    )}
                    <span
                      className="ui-label"
                      style={{ color: getStatusIndicatorColor(worker.status) }}
                    >
                      {worker.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Platform Badge */}
              <div className="mb-4">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium ui-text"
                  style={{
                    backgroundColor: "#f0f0f0",
                    color: "#111111",
                    border: "1px solid #e8e8e8",
                  }}
                >
                  {worker.platform}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="ui-label">Income Today</p>
                  <p
                    className="ui-data"
                    style={{ fontSize: "1.1875rem", marginTop: 4 }}
                  >
                    ₹{worker.income_today}
                  </p>
                </div>
                <div>
                  <p className="ui-label">Orders</p>
                  <p
                    className="ui-data"
                    style={{ fontSize: "1.1875rem", marginTop: 4 }}
                  >
                    {worker.orders_today}
                  </p>
                </div>
                <div>
                  <p className="ui-label">Risk Score</p>
                  <p
                    className="ui-data"
                    style={{
                      fontSize: "1.1875rem",
                      marginTop: 4,
                      color: getRiskColor(worker.fraud_risk_score),
                    }}
                  >
                    {getRiskLabel(worker.fraud_risk_score)}
                  </p>
                </div>
                <div>
                  <p className="ui-label">Days Active</p>
                  <p
                    className="ui-data"
                    style={{ fontSize: "1.1875rem", marginTop: 4 }}
                  >
                    {worker.days_since_active}
                  </p>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between ui-text">
                  <span style={{ color: "#666666" }}>Policy:</span>
                  <span
                    style={{
                      color: getPolicyColor(worker.policy_status),
                      fontWeight: 600,
                    }}
                  >
                    {worker.policy_status}
                  </span>
                </div>
                <div className="flex justify-between ui-text">
                  <span style={{ color: "#666666" }}>KYC:</span>
                  <span
                    style={{
                      color: getKycColor(worker.kyc_status),
                      fontWeight: 600,
                    }}
                  >
                    {worker.kyc_status}
                  </span>
                </div>
                <div className="flex justify-between ui-text">
                  <span style={{ color: "#666666" }}>Zone:</span>
                  <span style={{ color: "#000000", fontWeight: 500 }}>
                    {worker.zone_id}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <motion.button
                  onClick={() => setSelectedWorkerDetails(worker)}
                  className="flex-1 py-2 rounded-lg text-sx ui-text"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    backgroundColor: "#D9DFEA",
                    border: "1px solid #C5CDE0",
                    color: "#5B7A99",
                    fontWeight: 600,
                  }}
                >
                  <Eye className="w-4 h-4 inline mr-1" />
                  VIEW
                </motion.button>
                {worker.kyc_status === "pending" && (
                  <motion.button
                    onClick={() => console.log("Assist KYC:", worker.id)}
                    className="flex-1 py-2 rounded-lg text-sm ui-text"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      backgroundColor: "#D9DFEA",
                      border: "1px solid #C5CDE0",
                      color: "#5B7A99",
                      fontWeight: 600,
                    }}
                  >
                    <UserCheck className="w-4 h-4 inline mr-1" />
                    KYC
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredWorkers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No workers found</p>
            <p className="text-gray-500 text-sm">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* Worker Details Modal */}
      <AnimatePresence>
        {selectedWorkerDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedWorkerDetails(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className="sticky top-0 bg-white p-6 border-b"
                style={{ borderColor: "#e8e8e8" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      className="font-display"
                      style={{
                        fontSize: "1.6875rem",
                        fontWeight: 700,
                        color: "#000000",
                      }}
                    >
                      {selectedWorkerDetails.worker_name}
                    </h2>
                    <p
                      className="ui-text"
                      style={{ color: "#666666", marginTop: "4px" }}
                    >
                      ID: {selectedWorkerDetails.worker_id}
                    </p>
                  </div>
                  <motion.button
                    onClick={() => setSelectedWorkerDetails(null)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: "#f0f0f0" }}
                  >
                    <X className="w-5 h-5" style={{ color: "#000000" }} />
                  </motion.button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Status Overview */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <p className="ui-label mb-2">Status</p>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: getStatusIndicatorColor(
                            selectedWorkerDetails.status,
                          ),
                        }}
                      ></div>
                      <p className="ui-data">
                        {selectedWorkerDetails.status.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <p className="ui-label mb-2">Policy</p>
                    <p
                      className="ui-data"
                      style={{
                        color: getPolicyColor(
                          selectedWorkerDetails.policy_status,
                        ),
                      }}
                    >
                      {selectedWorkerDetails.policy_status.toUpperCase()}
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <p className="ui-label mb-2">KYC Status</p>
                    <p
                      className="ui-data"
                      style={{
                        color: getKycColor(selectedWorkerDetails.kyc_status),
                      }}
                    >
                      {selectedWorkerDetails.kyc_status.toUpperCase()}
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    <p className="ui-label mb-2">Risk Score</p>
                    <p
                      className="ui-data"
                      style={{
                        color: getRiskColor(
                          selectedWorkerDetails.fraud_risk_score,
                        ),
                      }}
                    >
                      {getRiskLabel(selectedWorkerDetails.fraud_risk_score)}
                    </p>
                  </div>
                </div>

                {/* Performance Section */}
                <div className="mb-8">
                  <h3
                    className="font-display mb-4"
                    style={{
                      fontSize: "1.3125rem",
                      fontWeight: 700,
                      color: "#000000",
                    }}
                  >
                    Performance Today
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #e8e8e8",
                      }}
                    >
                      <p className="ui-label mb-2">Income</p>
                      <p className="ui-data">
                        ₹{selectedWorkerDetails.income_today.toLocaleString()}
                      </p>
                    </div>
                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #e8e8e8",
                      }}
                    >
                      <p className="ui-label mb-2">Orders Completed</p>
                      <p className="ui-data">
                        {selectedWorkerDetails.orders_today}
                      </p>
                    </div>
                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #e8e8e8",
                      }}
                    >
                      <p className="ui-label mb-2">Days Active</p>
                      <p className="ui-data">
                        {selectedWorkerDetails.days_since_active}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="mb-8">
                  <h3
                    className="font-display mb-4"
                    style={{
                      fontSize: "1.3125rem",
                      fontWeight: 700,
                      color: "#000000",
                    }}
                  >
                    Details
                  </h3>
                  <div className="space-y-3">
                    <div
                      className="flex items-start space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <MapPin
                        className="w-5 h-5 mt-0.5"
                        style={{ color: "#666666" }}
                      />
                      <div>
                        <p className="ui-label">Zone</p>
                        <p className="ui-text">
                          {selectedWorkerDetails.zone_id}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-start space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <TrendingUp
                        className="w-5 h-5 mt-0.5"
                        style={{ color: "#666666" }}
                      />
                      <div>
                        <p className="ui-label">Platform</p>
                        <p className="ui-text">
                          {selectedWorkerDetails.platform}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-start space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <Shield
                        className="w-5 h-5 mt-0.5"
                        style={{ color: "#666666" }}
                      />
                      <div>
                        <p className="ui-label">Vehicle Type</p>
                        <p className="ui-text">
                          {selectedWorkerDetails.vehicle_type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-start space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <Clock
                        className="w-5 h-5 mt-0.5"
                        style={{ color: "#666666" }}
                      />
                      <div>
                        <p className="ui-label">Fraud Risk Score</p>
                        <p
                          className="ui-text"
                          style={{
                            color: getRiskColor(
                              selectedWorkerDetails.fraud_risk_score,
                            ),
                            fontWeight: 600,
                          }}
                        >
                          {(
                            selectedWorkerDetails.fraud_risk_score * 100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information - Mock Data */}
                <div className="mb-8">
                  <h3
                    className="font-display mb-4"
                    style={{
                      fontSize: "1.3125rem",
                      fontWeight: 700,
                      color: "#000000",
                    }}
                  >
                    Contact Information
                  </h3>
                  <div className="space-y-3">
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <Phone className="w-5 h-5" style={{ color: "#666666" }} />
                      <div>
                        <p className="ui-label">Phone</p>
                        <p className="ui-text">
                          +91{" "}
                          {String(
                            9000000000 + selectedWorkerDetails.worker_id,
                          ).slice(-10)}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <Mail className="w-5 h-5" style={{ color: "#666666" }} />
                      <div>
                        <p className="ui-label">Email</p>
                        <p className="ui-text">
                          {selectedWorkerDetails.worker_name
                            .toLowerCase()
                            .replace(" ", "")}
                          @worker.local
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#f5f5f5" }}
                    >
                      <Calendar
                        className="w-5 h-5"
                        style={{ color: "#666666" }}
                      />
                      <div>
                        <p className="ui-label">Joined</p>
                        <p className="ui-text">
                          2025-
                          {String(Math.floor(Math.random() * 12) + 1).padStart(
                            2,
                            "0",
                          )}
                          -
                          {String(Math.floor(Math.random() * 28) + 1).padStart(
                            2,
                            "0",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {selectedWorkerDetails.kyc_status === "pending" && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 py-3 rounded-lg ui-text"
                      style={{
                        backgroundColor: "#D9DFEA",
                        color: "#5B7A99",
                        fontWeight: 600,
                        border: "1px solid #C5CDE0",
                      }}
                    >
                      <UserCheck className="w-4 h-4 inline mr-2" />
                      ASSIST KYC VERIFICATION
                    </motion.button>
                  )}
                  <motion.button
                    onClick={() => setSelectedWorkerDetails(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 rounded-lg ui-text"
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#000000",
                      fontWeight: 600,
                      border: "1px solid #e8e8e8",
                    }}
                  >
                    CLOSE
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Workers;
