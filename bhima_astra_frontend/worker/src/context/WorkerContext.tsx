import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  getWorkerProfile,
  getWorkerPayouts,
  getEarningsEstimate,
  getActivePolicy,
  getZoneLive,
  getZoneForecast,
  getToken,
  type WorkerProfile,
  type PayoutItem,
  type EarningsEstimate,
  type ActivePolicy,
  type ZoneLiveData,
  type ZoneForecast,
} from '../services/api';

// ── Context shape ─────────────────────────────────────────────────────────────

interface WorkerContextType {
  profile: WorkerProfile | null;
  policy: ActivePolicy | null;
  payouts: PayoutItem[];
  earningsEstimate: EarningsEstimate | null;
  zoneLive: ZoneLiveData | null;
  zoneForecast: ZoneForecast | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshPayouts: () => Promise<void>;
}

const WorkerContext = createContext<WorkerContextType>({
  profile: null,
  policy: null,
  payouts: [],
  earningsEstimate: null,
  zoneLive: null,
  zoneForecast: null,
  loading: false,
  error: null,
  refresh: async () => {},
  refreshPayouts: async () => {},
});

export const useWorker = (): WorkerContextType => useContext(WorkerContext);

// ── Provider ──────────────────────────────────────────────────────────────────

export const WorkerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [policy, setPolicy] = useState<ActivePolicy | null>(null);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [earningsEstimate, setEarningsEstimate] =
    useState<EarningsEstimate | null>(null);
  const [zoneLive, setZoneLive] = useState<ZoneLiveData | null>(null);
  const [zoneForecast, setZoneForecast] = useState<ZoneForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      // Core worker data – fetch in parallel
      const [profileRes, policyRes, payoutsRes, earningsRes] =
        await Promise.allSettled([
          getWorkerProfile(),
          getActivePolicy(),
          getWorkerPayouts(),
          getEarningsEstimate(),
        ]);

      let resolvedProfile: WorkerProfile | null = null;

      if (profileRes.status === 'fulfilled') {
        resolvedProfile = profileRes.value;
        setProfile(profileRes.value);
      } else {
        console.warn('[WorkerContext] profile fetch failed:', profileRes.reason);
      }

      if (policyRes.status === 'fulfilled') {
        setPolicy(policyRes.value);
      }

      if (payoutsRes.status === 'fulfilled') {
        setPayouts(payoutsRes.value);
      }

      if (earningsRes.status === 'fulfilled') {
        setEarningsEstimate(earningsRes.value);
      }

      // Zone data depends on geo_zone_id from profile
      const zoneId = resolvedProfile?.geo_zone_id;
      if (zoneId) {
        const [zoneLiveRes, zoneForecastRes] = await Promise.allSettled([
          getZoneLive(zoneId),
          getZoneForecast(zoneId),
        ]);

        if (zoneLiveRes.status === 'fulfilled') {
          setZoneLive(zoneLiveRes.value);
        }
        if (zoneForecastRes.status === 'fulfilled') {
          setZoneForecast(zoneForecastRes.value);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
      console.error('[WorkerContext] fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPayouts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await getWorkerPayouts();
      setPayouts(data);
    } catch (err) {
      console.warn('[WorkerContext] refreshPayouts failed:', err);
    }
  }, []);

  // Fetch on mount if token exists
  useEffect(() => {
    if (getToken()) {
      fetchAll();
    }
  }, [fetchAll]);

  return (
    <WorkerContext.Provider
      value={{
        profile,
        policy,
        payouts,
        earningsEstimate,
        zoneLive,
        zoneForecast,
        loading,
        error,
        refresh: fetchAll,
        refreshPayouts,
      }}
    >
      {children}
    </WorkerContext.Provider>
  );
};
