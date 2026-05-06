import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  DollarSign,
  MapPin,
  Filter,
  Eye,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useManager } from './src/context/ManagerContext';
import { getManagerToken } from './src/services/managerApi';

const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || 'http://localhost:8000';

// ── Types ────────────────────────────────────────────────────────────────────
interface DisruptionFlag {
  flag_id: number;
  manager_id: number;
  zone_id: string;
  disruption_type: string;
  description: string;
  evidence_url: string;
  estimated_start: string;
  estimated_end: string;
  flag_status: 'pending' | 'verified' | 'rejected';
  route_feasible: boolean | null;
  workers_in_zone: number | null;
  estimated_payout: number | null;
  payout_enabled: boolean;
  created_at: string;
}

interface AffectedWorker {
  worker_id: number;
  worker_name: string | null;
  platform: string | null;
  policy_status: string | null;
  fraud_risk_score: number | null;
  kyc_verified: boolean | null;
}

// ── API fetch ────────────────────────────────────────────────────────────────
const fetchMyFlags = async (): Promise<DisruptionFlag[]> => {
  const token = getManagerToken();
  const res = await fetch(`${BASE_URL}/manager/me/flags`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data as DisruptionFlag[];
  if (data && Array.isArray(data.flags)) return data.flags as DisruptionFlag[];
  return [];
};

const fetchFlagAffectedWorkers = async (flagId: number): Promise<AffectedWorker[]> => {
  const token = getManagerToken();
  const res = await fetch(
    `${BASE_URL}/manager/flags/${flagId}/affected-workers`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((w: any) => ({
    worker_id: w.worker_id,
    worker_name: w.worker_name ?? null,
    platform: w.platform ?? null,
    policy_status: w.policy_status ?? null,
    fraud_risk_score: w.fraud_risk_score ?? null,
    kyc_verified: w.kyc_verified ?? null,
  }));
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':  return '#CDA955';
    case 'verified': return '#7A9F8C';
    case 'rejected': return '#A55F4F';
    default:         return '#999999';
  }
};

const getStatusBg = (status: string): string => {
  switch (status) {
    case 'pending':  return 'rgba(205,169,85,0.12)';
    case 'verified': return 'rgba(122,159,140,0.12)';
    case 'rejected': return 'rgba(165,95,79,0.12)';
    default:         return 'rgba(153,153,153,0.12)';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':  return <Clock className="w-4 h-4" />;
    case 'verified': return <CheckCircle className="w-4 h-4" />;
    case 'rejected': return <XCircle className="w-4 h-4" />;
    default:         return <AlertTriangle className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: string): string =>
  type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return d; }
};

// ── Component ─────────────────────────────────────────────────────────────────
const FlagHistory: React.FC = () => {
  const navigate = useNavigate();
  const [flags, setFlags] = useState<DisruptionFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedFlag, setSelectedFlag] = useState<DisruptionFlag | null>(null);
  const [affectedWorkers, setAffectedWorkers] = useState<AffectedWorker[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyFlags();
      // Deduplicate by flag_id — keep only the first occurrence
      const seen = new Set<number>();
      const deduped = data.filter((f) => {
        if (seen.has(f.flag_id)) return false;
        seen.add(f.flag_id);
        return true;
      });
      setFlags(deduped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flag history');
    } finally {
      setLoading(false);
    }
  }, []);

  // When a flag is selected, fetch only that flag's affected workers
  const handleViewDetails = useCallback(async (flag: DisruptionFlag) => {
    setSelectedFlag(flag);
    setAffectedWorkers([]);
    setWorkersLoading(true);
    try {
      const workers = await fetchFlagAffectedWorkers(flag.flag_id);
      setAffectedWorkers(workers);
    } catch {
      setAffectedWorkers([]);
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtered list
  const filtered = flags.filter((f) => {
    if (statusFilter !== 'all' && f.flag_status !== statusFilter) return false;
    if (typeFilter !== 'all' && f.disruption_type !== typeFilter) return false;
    return true;
  });

  // Unique disruption types for filter dropdown
  const types = Array.from(new Set(flags.map((f) => f.disruption_type)));

  // CSV download
  const handleDownload = () => {
    if (filtered.length === 0) return;
    const headers = ['ID', 'Zone', 'Type', 'Status', 'Description', 'Workers', 'Est. Payout (₹)', 'Flagged At'];
    const rows = filtered.map((f) => [
      f.flag_id,
      f.zone_id,
      getTypeLabel(f.disruption_type),
      f.flag_status,
      `"${(f.description || '').replace(/"/g, "'")}"`,
      f.workers_in_zone ?? 0,
      f.estimated_payout ?? 0,
      fmtDate(f.created_at),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flag-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f8f8' }}>
      {/* Header */}
      <header className="bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={() => navigate('/manager/dashboard')}
              whileHover={{ x: -5 }}
              className="ui-text transition-colors flex items-center"
              style={{ color: '#666666' }}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              BACK TO DASHBOARD
            </motion.button>
            <div
              className="w-8 h-8"
              style={{
                backgroundColor: '#1a1a1a',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h1 className="font-display" style={{ fontSize: '1.1875rem', fontWeight: 700, color: '#000000' }}>
                BHIMA ASTRA
              </h1>
              <p className="ui-label" style={{ color: '#666666' }}>Flag History</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="ui-text" style={{ color: '#666666', fontSize: '0.8125rem' }}>
              {new Date().toLocaleString('en-IN')}
            </div>
            <motion.button
              onClick={load}
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.4 }}
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" style={{ color: '#666666' }} />
            </motion.button>
            <button onClick={handleDownload} title="Download CSV">
              <Download className="w-5 h-5" style={{ color: '#666666' }} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="ui-label mb-2">Flag Management</div>
          <h1 className="font-display mb-4" style={{ fontSize: '1.9375rem', color: '#000000' }}>
            Disruption Flag History
          </h1>
          <p className="ui-text" style={{ color: '#666666' }}>
            All flags submitted by your account — track verification status and payout outcomes.
          </p>
        </div>

        {/* Filters */}
        <div
          className="bg-white p-6 rounded-lg mb-6"
          style={{ border: '1px solid #e8e8e8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status */}
            <div>
              <label className="block ui-label mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 bg-white rounded-lg focus:outline-none ui-text"
                style={{ border: '1px solid #e8e8e8', color: '#333333' }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block ui-label mb-2">Disruption Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-2 bg-white rounded-lg focus:outline-none ui-text"
                style={{ border: '1px solid #e8e8e8', color: '#333333' }}
              >
                <option value="all">All Types</option>
                {types.map((t) => (
                  <option key={t} value={t}>{getTypeLabel(t)}</option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div>
              <label className="block ui-label mb-2">Results</label>
              <div className="px-4 py-2 bg-white rounded-lg" style={{ border: '1px solid #e8e8e8' }}>
                <span className="ui-data">{filtered.length} flag{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: '#999' }} />
            <p className="ui-text" style={{ color: '#666666' }}>Loading flags…</p>
          </div>
        )}

        {error && !loading && (
          <div
            className="p-4 rounded-lg mb-6 flex items-center space-x-3"
            style={{ backgroundColor: 'rgba(165,95,79,0.08)', border: '1px solid rgba(165,95,79,0.3)' }}
          >
            <AlertTriangle className="w-5 h-5" style={{ color: '#A55F4F' }} />
            <p className="ui-text" style={{ color: '#A55F4F' }}>{error}</p>
          </div>
        )}

        {/* Flag Cards */}
        {!loading && !error && (
          <div className="space-y-6">
            {filtered.length > 0 ? (
              filtered.map((flag, index) => (
                <motion.div
                  key={flag.flag_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-lg"
                  style={{ border: '1px solid #e8e8e8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  {/* Card Header */}
                  <div
                    className="p-5"
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: getStatusBg(flag.flag_status),
                      borderRadius: '8px 8px 0 0',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="flex items-center space-x-2 px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: getStatusColor(flag.flag_status),
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {getStatusIcon(flag.flag_status)}
                          <span className="ml-1">{flag.flag_status.toUpperCase()}</span>
                        </div>
                        <span
                          className="ui-label px-3 py-1 rounded-full"
                          style={{ backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #e8e8e8' }}
                        >
                          {getTypeLabel(flag.disruption_type)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="ui-label" style={{ color: '#999' }}>Flag #{flag.flag_id}</p>
                        <p className="ui-text" style={{ color: '#666', fontSize: '0.75rem' }}>
                          {fmtDate(flag.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Description */}
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <MapPin className="w-4 h-4" style={{ color: '#666' }} />
                          <span className="ui-label" style={{ color: '#666' }}>Zone: {flag.zone_id}</span>
                        </div>
                        <p className="ui-text" style={{ color: '#333', lineHeight: 1.6 }}>
                          {flag.description || <em style={{ color: '#999' }}>No description provided</em>}
                        </p>
                        {flag.evidence_url && (
                          <a
                            href={flag.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 mt-2"
                            style={{ color: '#5B7A99', fontSize: '0.8125rem' }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View Evidence</span>
                          </a>
                        )}
                      </div>

                      {/* Right: Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <Users className="w-3 h-3" style={{ color: '#999' }} />
                            <p className="ui-label" style={{ color: '#999' }}>Workers</p>
                          </div>
                          <p className="ui-data" style={{ fontSize: '1.25rem' }}>
                            {flag.workers_in_zone ?? '—'}
                          </p>
                        </div>

                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <DollarSign className="w-3 h-3" style={{ color: '#999' }} />
                            <p className="ui-label" style={{ color: '#999' }}>Est. Payout</p>
                          </div>
                          <p className="ui-data" style={{ fontSize: '1.25rem' }}>
                            {flag.estimated_payout != null
                              ? `₹${flag.estimated_payout.toLocaleString('en-IN')}`
                              : '—'}
                          </p>
                        </div>

                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                        >
                          <p className="ui-label mb-1" style={{ color: '#999' }}>Start</p>
                          <p className="ui-text" style={{ fontSize: '0.8125rem', color: '#333' }}>
                            {flag.estimated_start ? fmtDate(flag.estimated_start) : '—'}
                          </p>
                        </div>

                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                        >
                          <p className="ui-label mb-1" style={{ color: '#999' }}>End</p>
                          <p className="ui-text" style={{ fontSize: '0.8125rem', color: '#333' }}>
                            {flag.estimated_end ? fmtDate(flag.estimated_end) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Payout badge */}
                    {flag.payout_enabled && (
                      <div
                        className="mt-4 inline-flex items-center space-x-2 px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: 'rgba(122,159,140,0.15)',
                          border: '1px solid rgba(122,159,140,0.4)',
                          color: '#7A9F8C',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Payout Enabled</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer — view details button */}
                  <div
                    className="px-5 pb-5 flex justify-end"
                  >
                    <motion.button
                      onClick={() => handleViewDetails(flag)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center space-x-2 px-4 py-2 rounded-lg ui-text"
                      style={{
                        backgroundColor: '#D9DFEA',
                        border: '1px solid #C5CDE0',
                        color: '#5B7A99',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      <span>VIEW DETAILS</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4" style={{ color: '#ccc' }} />
                <h3 className="font-display mb-2" style={{ fontSize: '1.3125rem', color: '#000' }}>No Flags Found</h3>
                <p className="ui-text" style={{ color: '#666666' }}>
                  {statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'Try adjusting your filters to see more results.'
                    : 'No disruption flags have been submitted yet.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedFlag && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedFlag(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="sticky top-0 bg-white p-5 border-b flex justify-between items-start"
              style={{ borderColor: '#e8e8e8', borderRadius: '8px 8px 0 0' }}
            >
              <div>
                <h2 className="font-display" style={{ fontSize: '1.375rem', fontWeight: 700 }}>
                  Flag #{selectedFlag.flag_id}
                </h2>
                <p className="ui-label" style={{ color: '#666' }}>
                  {getTypeLabel(selectedFlag.disruption_type)} — {selectedFlag.zone_id}
                </p>
              </div>
              <button onClick={() => setSelectedFlag(null)}>
                <XCircle className="w-6 h-6" style={{ color: '#999' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Description */}
              <p className="ui-text" style={{ color: '#333' }}>{selectedFlag.description}</p>

              {/* Key stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                >
                  <p className="ui-label" style={{ color: '#999' }}>Status</p>
                  <p className="ui-data" style={{ color: getStatusColor(selectedFlag.flag_status) }}>
                    {selectedFlag.flag_status.toUpperCase()}
                  </p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                >
                  <p className="ui-label" style={{ color: '#999' }}>Payout</p>
                  <p className="ui-data">{selectedFlag.payout_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                >
                  <p className="ui-label" style={{ color: '#999' }}>Workers in Zone</p>
                  <p className="ui-data">{(selectedFlag.workers_in_zone ?? affectedWorkers.length) || '—'}</p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                >
                  <p className="ui-label" style={{ color: '#999' }}>Est. Payout</p>
                  <p className="ui-data">
                    {selectedFlag.estimated_payout != null
                      ? `₹${selectedFlag.estimated_payout.toLocaleString('en-IN')}`
                      : '—'}
                  </p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                >
                  <p className="ui-label" style={{ color: '#999' }}>Flagged At</p>
                  <p className="ui-text" style={{ fontSize: '0.8125rem' }}>{fmtDate(selectedFlag.created_at)}</p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: '#f5f5f5', border: '1px solid #e8e8e8' }}
                >
                  <p className="ui-label" style={{ color: '#999' }}>Route Feasible</p>
                  <p className="ui-data">
                    {selectedFlag.route_feasible == null ? '—' : selectedFlag.route_feasible ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Evidence link */}
              {selectedFlag.evidence_url && (
                <a
                  href={selectedFlag.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1"
                  style={{ color: '#5B7A99', fontSize: '0.8125rem' }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Evidence Link</span>
                </a>
              )}

              {/* ── Affected Workers Section ─────────────────────────────── */}
              <div>
                <div
                  className="flex items-center space-x-2 mb-3"
                  style={{ borderTop: '1px solid #e8e8e8', paddingTop: '1rem' }}
                >
                  <Users className="w-4 h-4" style={{ color: '#666' }} />
                  <h3 className="font-display" style={{ fontSize: '1rem', fontWeight: 700, color: '#000' }}>
                    Affected Workers in {selectedFlag.zone_id}
                  </h3>
                </div>

                {workersLoading ? (
                  <div className="flex items-center space-x-2 py-3">
                    <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#999' }} />
                    <span className="ui-text" style={{ color: '#999' }}>Loading workers…</span>
                  </div>
                ) : affectedWorkers.length === 0 ? (
                  <p className="ui-text" style={{ color: '#999', fontStyle: 'italic' }}>
                    No worker data available for this zone.
                  </p>
                ) : (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid #e8e8e8' }}
                  >
                    {/* Table header */}
                    <div
                      className="grid grid-cols-4 px-3 py-2 ui-label"
                      style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #e8e8e8', color: '#666' }}
                    >
                      <span>Worker</span>
                      <span>ID</span>
                      <span>Status</span>
                      <span>Risk</span>
                    </div>

                    {/* Table rows */}
                    {affectedWorkers.map((w, idx) => {
                      const score = w.fraud_risk_score ?? 0;
                      const riskLabel = score < 0.3 ? 'LOW' : score < 0.7 ? 'MED' : 'HIGH';
                      const riskColor = score < 0.3 ? '#7A9F8C' : score < 0.7 ? '#8B7355' : '#A55F4F';
                      const isOnline = w.kyc_verified;
                      return (
                        <div
                          key={w.worker_id}
                          className="grid grid-cols-4 px-3 py-2 ui-text"
                          style={{
                            borderBottom: idx < affectedWorkers.length - 1 ? '1px solid #f0f0f0' : 'none',
                            backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa',
                          }}
                        >
                          <span style={{ color: '#000', fontWeight: 500 }}>
                            {w.worker_name ?? '—'}
                          </span>
                          <span style={{ color: '#666' }}>#{w.worker_id}</span>
                          <span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: isOnline ? '#7A9F8C' : '#999',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                              }}
                            >
                              <span
                                style={{
                                  width: 7, height: 7,
                                  borderRadius: '50%',
                                  backgroundColor: isOnline ? '#7A9F8C' : '#ccc',
                                  display: 'inline-block',
                                }}
                              />
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </span>
                          <span
                            style={{
                              color: riskColor,
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            {riskLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default FlagHistory;