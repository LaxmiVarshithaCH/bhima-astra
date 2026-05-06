import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  User,
  ChevronLeft,
} from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [managerId, setManagerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!managerId.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    try {
      const BASE_URL =
        (import.meta as unknown as { env: Record<string, string> }).env
          .VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${BASE_URL}/api/v1/auth/manager/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: managerId, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid credentials");
      }
      const data = await res.json();
      localStorage.setItem("bhima_manager_token", data.access_token);
      localStorage.setItem("bhima_manager_id", String(data.manager_id));
      localStorage.setItem("bhima_manager_name", data.manager_name || "");
      localStorage.setItem(
        "bhima_manager_zones",
        JSON.stringify(data.assigned_zones || []),
      );
      localStorage.setItem("managerLoggedIn", "true");
      onLogin();
      navigate("/manager/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: "Active Zones", value: "4" },
    { label: "Workers Online", value: "252" },
    { label: "Payouts Today", value: "₹2.85L" },
    { label: "Flags Raised", value: "3" },
  ];

  return (
    <>
      <style>{`
        /* ── layout ── */
        .mgr-root {
          display: flex;
          min-height: 100vh;
          width: 100%;
        }
        .mgr-left {
          width: 45%;
          background: #000;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          position: relative;
          overflow: hidden;
        }
        .mgr-left::before {
          content: "";
          position: absolute;
          top: -80px; right: -80px;
          width: 320px; height: 320px;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 50%;
          pointer-events: none;
        }
        .mgr-left::after {
          content: "";
          position: absolute;
          bottom: -60px; left: -60px;
          width: 240px; height: 240px;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 50%;
          pointer-events: none;
        }
        .mgr-right {
          width: 55%;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          position: relative;
        }

        /* corner accents */
        .mgr-corner { position: absolute; width: 20px; height: 20px; }
        .mgr-corner-tl { top: 24px; left: 24px; border-top: 1px solid var(--border-color); border-left: 1px solid var(--border-color); }
        .mgr-corner-tr { top: 24px; right: 24px; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); }
        .mgr-corner-bl { bottom: 24px; left: 24px; border-bottom: 1px solid var(--border-color); border-left: 1px solid var(--border-color); }
        .mgr-corner-br { bottom: 24px; right: 24px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); }

        /* stats row on dark bg */
        .mgr-stat-border { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; }

        /* input wrapper — uses neumorphic-inset from ui/index.css */
        .mgr-input-row {
          display: flex;
          align-items: center;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
        }
        .mgr-input-row:focus-within {
          border-color: #000;
          background: var(--bg-primary);
        }
        .mgr-input-icon {
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 48px;
          border-right: 1px solid var(--border-color);
          color: var(--text-quaternary);
          flex-shrink: 0;
        }
        .mgr-input-field {
          flex: 1;
          padding: 12px 14px;
          border: none; outline: none;
          font-family: "DM Mono", monospace;
          font-size: 14px; font-weight: 500;
          letter-spacing: 0.02em;
          background: transparent;
          color: var(--text-primary);
        }
        .mgr-input-field::placeholder { color: var(--text-quaternary); }

        /* eye toggle */
        .mgr-eye {
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 48px;
          background: none; border: none;
          cursor: pointer;
          color: var(--text-quaternary);
        }
        .mgr-eye:hover { color: var(--text-primary); }

        /* submit */
        .mgr-btn {
          width: 100%;
          padding: 14px;
          background: var(--text-primary);
          color: var(--bg-primary);
          border: 1px solid var(--text-primary);
          font-family: "DM Mono", monospace;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: background 0.2s, color 0.2s;
        }
        .mgr-btn:hover:not(:disabled) {
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .mgr-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* spinner */
        @keyframes mgr-spin { to { transform: rotate(360deg); } }
        .mgr-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: mgr-spin 0.7s linear infinite;
        }
        .mgr-btn:hover:not(:disabled) .mgr-spinner {
          border-color: rgba(0,0,0,0.15);
          border-top-color: #000;
        }

        /* divider */
        .mgr-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 22px 0;
        }
        .mgr-divider-line { flex: 1; height: 1px; background: var(--border-color); }

        /* badge tile */
        .mgr-badge {
          border: 1px solid var(--border-color);
          padding: 10px 8px;
          text-align: center;
          cursor: default;
        }
        .mgr-badge:hover { border-color: var(--text-primary); }

        @media (max-width: 768px) {
          .mgr-root  { flex-direction: column; }
          .mgr-left  { width: 100%; min-height: 260px; padding: 32px 24px; }
          .mgr-right { width: 100%; padding: 36px 24px; }
        }
      `}</style>

      <div className="mgr-root">
        {/* ─────────────── LEFT PANEL ─────────────── */}
        <div className="mgr-left">
          {/* Logo */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 52,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  background: "#fff",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield style={{ width: 20, height: 20, color: "#000" }} />
              </div>
              <div>
                {/* reuse display-text from ui/index.css */}
                <div
                  className="display-text"
                  style={{ fontSize: 18, color: "#fff", lineHeight: 1 }}
                >
                  BHIMA ASTRA
                </div>
                <div
                  className="ui-label"
                  style={{ color: "#555", marginTop: 3, fontSize: "0.7rem" }}
                >
                  Manager Portal
                </div>
              </div>
            </div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="ui-label"
                style={{ color: "#444", marginBottom: 14 }}
              >
                Dark Store Command Centre
              </div>

              {/* h1 from ui/index.css: Cormorant Garamond 3.6875rem — override color for dark bg */}
              <h1
                style={{
                  color: "#fff",
                  fontSize: "clamp(2.1rem, 3.6vw, 3.1rem)",
                  marginBottom: 20,
                  lineHeight: 1.08,
                }}
              >
                Manage.
                <br />
                Monitor.
                <br />
                Protect.
              </h1>

              <p className="body-text" style={{ color: "#666", maxWidth: 300 }}>
                Real-time oversight of gig workers, zone health, trigger events
                and payout pipelines — all in one place.
              </p>
            </motion.div>
          </div>

          {/* Live stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div
              className="ui-label"
              style={{ color: "#444", marginBottom: 20 }}
            >
              Live Overview · Today
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  className="mgr-stat-border"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
                >
                  {/* ui-data from ui/index.css — override color for dark bg */}
                  <div
                    className="ui-data"
                    style={{
                      color: "#fff",
                      fontSize: "1.85rem",
                      marginBottom: 4,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="ui-label"
                    style={{ color: "#555", fontSize: "0.7rem" }}
                  >
                    {s.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ─────────────── RIGHT PANEL ─────────────── */}
        <div className="mgr-right">
          <div className="mgr-corner mgr-corner-tl" />
          <div className="mgr-corner mgr-corner-tr" />
          <div className="mgr-corner mgr-corner-bl" />
          <div className="mgr-corner mgr-corner-br" />

          <motion.div
            style={{ maxWidth: 380, width: "100%" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {/* Go Back Button */}
            <motion.button
              onClick={() => (window.location.href = "/")}
              style={{
                marginBottom: 24,
                background: "none",
                border: "1px solid var(--text-primary)",
                color: "var(--text-primary)",
                padding: "8px 12px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontFamily: '"DM Mono", monospace',
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--text-primary)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--bg-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "none";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-primary)";
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
              Back
            </motion.button>

            {/* Eyebrow */}
            <div className="ui-label" style={{ marginBottom: 8 }}>
              Secure Access · Manager
            </div>

            {/* h2 from ui/index.css: Cormorant Garamond 2.6875rem, #000 */}
            <h2
              style={{
                marginBottom: 8,
                fontSize: "clamp(1.7rem, 2.6vw, 2.3rem)",
              }}
            >
              Manager Sign-In
            </h2>

            <p className="body-text" style={{ marginBottom: 36 }}>
              Enter your credentials to access the dark store management
              dashboard.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Manager ID */}
              <div style={{ marginBottom: 16 }}>
                <label
                  className="ui-label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Email
                </label>
                <div className="mgr-input-row">
                  <div className="mgr-input-icon">
                    <User style={{ width: 14, height: 14 }} />
                  </div>
                  <input
                    type="email"
                    className="mgr-input-field"
                    placeholder="ravi.manager@bhima.com"
                    value={managerId}
                    autoComplete="username"
                    onChange={(e) => {
                      setManagerId(e.target.value);
                      if (error) setError("");
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 6 }}>
                <label
                  className="ui-label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Password
                </label>
                <div className="mgr-input-row">
                  <div className="mgr-input-icon">
                    <Lock style={{ width: 14, height: 14 }} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="mgr-input-field"
                    placeholder="password123"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSubmit(e as any)
                    }
                  />
                  <button
                    type="button"
                    className="mgr-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff style={{ width: 14, height: 14 }} />
                    ) : (
                      <Eye style={{ width: 14, height: 14 }} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    className="ui-label"
                    style={{ color: "#b00020", marginBottom: 12, marginTop: 6 }}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              {!error && <div style={{ height: 20 }} />}

              {/* Submit */}
              <button type="submit" className="mgr-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="mgr-spinner" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    Access Dashboard{" "}
                    <ArrowRight style={{ width: 14, height: 14 }} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="mgr-divider">
              <div className="mgr-divider-line" />
              <span
                className="ui-label"
                style={{ fontSize: "0.7rem", color: "var(--text-quaternary)" }}
              >
                Verified Access
              </span>
              <div className="mgr-divider-line" />
            </div>

            {/* Trust badges — neumorphic from ui/index.css */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
              }}
            >
              {[
                { icon: "🔒", label: "256-bit SSL" },
                { icon: "🛡️", label: "IRDAI Listed" },
                { icon: "📋", label: "Govt. Approved" },
              ].map((b) => (
                <div key={b.label} className="neumorphic mgr-badge">
                  <div style={{ fontSize: 17 }}>{b.icon}</div>
                  <span
                    className="ui-label"
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: "0.7rem",
                    }}
                  >
                    {b.label}
                  </span>
                </div>
              ))}
            </div>

            <p
              className="body-text"
              style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: "0.8rem",
                color: "var(--text-quaternary)",
              }}
            >
              By signing in you agree to our{" "}
              <span
                style={{
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Terms
              </span>{" "}
              &{" "}
              <span
                style={{
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Privacy Policy
              </span>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
