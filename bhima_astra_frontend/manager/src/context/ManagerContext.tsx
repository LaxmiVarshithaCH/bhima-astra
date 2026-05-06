import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getManagerProfile,
  getManagerStats,
  getManagerFlags,
  getZoneLive,
  getZoneTriggers,
  getManagerToken,
  type ManagerProfile,
  type ManagerStats,
  type DisruptionFlag,
  type ZoneLiveData,
  type TriggerEvent,
} from "../services/managerApi";

interface ManagerContextType {
  profile: ManagerProfile | null;
  stats: ManagerStats | null;
  flags: DisruptionFlag[];
  zoneLiveData: Record<string, ZoneLiveData>;
  zoneTriggers: Record<string, TriggerEvent[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshFlags: () => Promise<void>;
}

const ManagerContext = createContext<ManagerContextType>({
  profile: null,
  stats: null,
  flags: [],
  zoneLiveData: {},
  zoneTriggers: {},
  loading: false,
  error: null,
  refresh: async () => {},
  refreshFlags: async () => {},
});

export const useManager = () => useContext(ManagerContext);

export const ManagerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [flags, setFlags] = useState<DisruptionFlag[]>([]);
  const [zoneLiveData, setZoneLiveData] = useState<
    Record<string, ZoneLiveData>
  >({});
  const [zoneTriggers, setZoneTriggers] = useState<
    Record<string, TriggerEvent[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const token = getManagerToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, statsRes, flagsRes] = await Promise.allSettled([
        getManagerProfile(),
        getManagerStats(),
        getManagerFlags(),
      ]);

      let resolvedProfile: ManagerProfile | null = null;
      if (profileRes.status === "fulfilled") {
        resolvedProfile = profileRes.value;
        setProfile(profileRes.value);
        // Cache dark store coords so FlagDisruption can seed map center instantly
        if (profileRes.value?.dark_store_lat) {
          localStorage.setItem("bhima_manager_dark_store_lat", String(profileRes.value.dark_store_lat));
          localStorage.setItem("bhima_manager_dark_store_lng", String(profileRes.value.dark_store_lng));
        }
      }
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (flagsRes.status === "fulfilled") setFlags(flagsRes.value);

      // Fetch zone data for each assigned zone
      const zones = resolvedProfile?.assigned_zones ?? [];
      if (zones.length > 0) {
        const liveResults = await Promise.allSettled(
          zones.map((z) => getZoneLive(z).then((data) => ({ zone: z, data }))),
        );
        const triggerResults = await Promise.allSettled(
          zones.map((z) =>
            getZoneTriggers(z, 5).then((data) => ({ zone: z, data })),
          ),
        );

        const liveMap: Record<string, ZoneLiveData> = {};
        const trigMap: Record<string, TriggerEvent[]> = {};

        liveResults.forEach((r) => {
          if (r.status === "fulfilled") liveMap[r.value.zone] = r.value.data;
        });
        triggerResults.forEach((r) => {
          if (r.status === "fulfilled") trigMap[r.value.zone] = r.value.data;
        });

        setZoneLiveData(liveMap);
        setZoneTriggers(trigMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshFlags = useCallback(async () => {
    const token = getManagerToken();
    if (!token) return;
    try {
      const data = await getManagerFlags();
      setFlags(data);
    } catch {
      // silently ignore refresh errors
    }
  }, []);

  useEffect(() => {
    if (getManagerToken()) fetchAll();
  }, [fetchAll]);

  return (
    <ManagerContext.Provider
      value={{
        profile,
        stats,
        flags,
        zoneLiveData,
        zoneTriggers,
        loading,
        error,
        refresh: fetchAll,
        refreshFlags,
      }}
    >
      {children}
    </ManagerContext.Provider>
  );
};
