import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getToken } from "../services/api";

/* ── Types ───────────────────────────────────────────── */
export interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type?: "ticket" | "payout" | "alert" | "info";
}

/* ── Fallback data shown while API loads or on error */
const fallbackNotifications: Notification[] = [
  {
    id: 1,
    title: "Policy Triggered",
    message: "Your policy was triggered for composite event (L2) in your zone.",
    time: "2 mins ago",
    read: false,
    type: "ticket",
  },
  {
    id: 2,
    title: "Payout Credited",
    message: "₹591 credited to your UPI account for aqi trigger (L3).",
    time: "1 hr ago",
    read: true,
    type: "payout",
  },
  {
    id: 3,
    title: "Coverage Alert",
    message: "Heavy rainfall detected in your zone. Policy triggered.",
    time: "3 hrs ago",
    read: false,
    type: "alert",
  },
  {
    id: 4,
    title: "Payout Processing",
    message: "Your flood claim (L3) payout is being processed.",
    time: "1 day ago",
    read: true,
    type: "info",
  },
];

/* ── Live API fetch from backend */
const BASE_URL =
  ((import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL as string) || "http://localhost:8000";

const fetchNotifications = async (): Promise<Notification[]> => {
  const token = getToken();
  if (!token) return fallbackNotifications;
  try {
    const res = await fetch(`${BASE_URL}/workers/me/notifications`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return fallbackNotifications;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data as Notification[];
    return fallbackNotifications;
  } catch {
    return fallbackNotifications;
  }
};

/* ── Disruption alerts for affected workers */
const fetchDisruptionAlerts = async (): Promise<Notification[]> => {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${BASE_URL}/workers/me/disruption-alerts`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // Convert string IDs like "flag-42" to numeric (1_000_000 + flag_id) to stay typed as number
    return data.map((a: any) => ({
      ...a,
      id: typeof a.id === "string"
        ? 1_000_000 + parseInt(a.id.replace("flag-", "") || "0", 10)
        : a.id,
    })) as Notification[];
  } catch {
    return [];
  }
};

/* ── Type accent helper ─────────────────────────────── */
const typeAccent = (type?: string) => {
  switch (type) {
    case "ticket":
      return { color: "#FBBF24", icon: "🎫" };
    case "payout":
      return { color: "#22c55e", icon: "₹" };
    case "alert":
      return { color: "#FF5C5C", icon: "⚡" };
    default:
      return { color: "#60A5FA", icon: "🔔" };
  }
};

/* ══════════════════════════════════════════════════════
   NOTIFICATION PANEL COMPONENT
══════════════════════════════════════════════════════ */
const NotificationsPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Fetch from backend on mount, refresh every 30s ──────────────────── */
  const load = useCallback(async () => {
    const [policyData, alertData] = await Promise.allSettled([
      fetchNotifications(),
      fetchDisruptionAlerts(),
    ]);
    const policy = policyData.status === "fulfilled" ? policyData.value : fallbackNotifications;
    const alerts = alertData.status === "fulfilled" ? alertData.value : [];
    // Disruption alerts appear first (most urgent), then policy notifications
    setNotifications([...alerts, ...policy]);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);

    // Future (WebSocket):
    // fetchNotifications().then(setNotifications).catch(console.error);
  }, []);

  /* Close on outside click ───────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: number) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* ── Bell Button ─────────────────────────────── */}
      <button
        id="notifications-bell-btn"
        aria-label="Open notifications"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 34,
          height: 34,
          borderRadius: 8,
          background: open ? "rgba(251,191,36,0.12)" : "rgba(0,0,0,0.04)",
          border: open
            ? "1px solid rgba(251,191,36,0.4)"
            : "1px solid rgba(0,0,0,0.1)",
          color: open ? "#FBBF24" : "#64748B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
          flexShrink: 0,
        }}
        onMouseOver={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(0,0,0,0.06)";
            (e.currentTarget as HTMLButtonElement).style.color = "#334155";
          }
        }}
        onMouseOut={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(0,0,0,0.04)";
            (e.currentTarget as HTMLButtonElement).style.color = "#64748B";
          }
        }}
      >
        {/* Bell SVG */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              background: "#FF5C5C",
              borderRadius: 999,
              border: "1.5px solid #0B0F1A",
              fontSize: 9,
              fontFamily: "DM Mono, monospace",
              fontWeight: 500,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              letterSpacing: 0,
              padding: "0 3px",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ──────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="notifications-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: "min(360px, 92vw)",
              background: "#FFFFFF",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 14,
              boxShadow:
                "0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)",
              zIndex: 500,
              overflow: "hidden",
            }}
          >
            {/* Top accent line */}
            <div
              style={{
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)",
              }}
            />

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px 12px",
                borderBottom: "1px solid #E2E8F0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#64748B",
                  }}
                >
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: "rgba(255,92,92,0.15)",
                      border: "1px solid rgba(255,92,92,0.35)",
                      color: "#FF5C5C",
                      fontFamily: "DM Mono, monospace",
                      fontSize: 7,
                      padding: "1px 6px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: "none",
                    border: "none",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 8,
                    color: "#3B82F6",
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#2563EB")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#3B82F6")}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div
              style={{ maxHeight: 380, overflowY: "auto", padding: "8px 0" }}
            >
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 10,
                    color: "#94A3B8",
                  }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const accent = typeAccent(n.type);
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      onClick={() => markRead(n.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "13px 18px",
                        cursor: "pointer",
                        background: n.read ? "transparent" : "rgba(0,0,0,0.02)",
                        borderLeft: n.read
                          ? "2px solid transparent"
                          : `2px solid ${accent.color}`,
                        transition: "background 0.2s",
                        position: "relative",
                      }}
                      whileHover={{ background: "rgba(0,0,0,0.04)" } as any}
                    >
                      {/* Icon bubble */}
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          flexShrink: 0,
                          background: `${accent.color}14`,
                          border: `1px solid ${accent.color}30`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          marginTop: 1,
                        }}
                      >
                        {accent.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 10,
                              color: n.read ? "#64748B" : "#0F172A",
                              fontWeight: n.read ? 400 : 500,
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {n.title}
                          </span>
                          <span
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 8,
                              color: "#94A3B8",
                              letterSpacing: "0.04em",
                              flexShrink: 0,
                            }}
                          >
                            {n.time}
                          </span>
                        </div>
                        <p
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 9,
                            color: "#475569",
                            lineHeight: 1.55,
                            margin: 0,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {n.message}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: accent.color,
                            flexShrink: 0,
                            marginTop: 3,
                            boxShadow: `0 0 6px ${accent.color}80`,
                          }}
                        />
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "1px solid #E2E8F0",
                padding: "10px 18px",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 8,
                  color: "#94A3B8",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Backend integration ready · /api/notifications
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationsPanel;
