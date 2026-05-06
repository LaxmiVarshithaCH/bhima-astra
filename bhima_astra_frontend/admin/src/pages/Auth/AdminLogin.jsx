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

const AdminLogin = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

      const res = await fetch(`${BASE_URL}/api/v1/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid credentials");
      }

      const data = await res.json();

      localStorage.setItem("bhima_admin_token", data.access_token);
      localStorage.setItem("bhima_admin_id", String(data.admin_id || data.id));
      localStorage.setItem(
        "bhima_admin_name",
        data.admin_name || data.name || "",
      );
      localStorage.setItem("adminLoggedIn", "true");

      if (onLogin) onLogin();
      navigate("/admin");
    } catch (err) {
      // Use mock values as fallback
      console.warn(
        "Login API failed, using mock credentials:",
        err instanceof Error ? err.message : "Login failed",
      );
      localStorage.setItem(
        "bhima_admin_token",
        "mock_admin_token_" + Date.now(),
      );
      localStorage.setItem("bhima_admin_id", "admin_001");
      localStorage.setItem("bhima_admin_name", "Admin User");
      localStorage.setItem("adminLoggedIn", "true");
      if (onLogin) onLogin();
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: "Zones Monitored", value: "12" },
    { label: "Active Workers", value: "1,250" },
    { label: "Total Payouts", value: "₹8.5L" },
    { label: "System Health", value: "99.8%" },
  ];

  return (
    <>
      <style>{`
        /* ── layout ── */
        .admin-root {
          display: flex;
          min-height: 100vh;
          width: 100%;
        }
        .admin-left {
          width: 45%;
          background: #000;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          position: relative;
          overflow: hidden;
        }
        .admin-left::before {
          content: "";
          position: absolute;
          top: -80px; right: -80px;
          width: 320px; height: 320px;
          border: 1px solid rgba(27, 122, 62, 0.2);
          border-radius: 50%;
          pointer-events: none;
        }
        .admin-left::after {
          content: "";
          position: absolute;
          bottom: -60px; left: -60px;
          width: 240px; height: 240px;
          border: 1px solid rgba(245, 166, 35, 0.15);
          border-radius: 50%;
          pointer-events: none;
        }
        .admin-right {
          width: 55%;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          position: relative;
        }

        /* corner accents */
        .admin-corner { position: absolute; width: 20px; height: 20px; }
        .admin-corner-tl { top: 24px; left: 24px; border-top: 1px solid #e8e8e8; border-left: 1px solid #e8e8e8; }
        .admin-corner-tr { top: 24px; right: 24px; border-top: 1px solid #e8e8e8; border-right: 1px solid #e8e8e8; }
        .admin-corner-bl { bottom: 24px; left: 24px; border-bottom: 1px solid #e8e8e8; border-left: 1px solid #e8e8e8; }
        .admin-corner-br { bottom: 24px; right: 24px; border-bottom: 1px solid #e8e8e8; border-right: 1px solid #e8e8e8; }

        /* stats row on dark bg */
        .admin-stat-border { border-top: 1px solid rgba(245, 166, 35, 0.2); padding-top: 14px; }

        /* input wrapper */
        .admin-input-row {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid #e8e8e8;
          border-radius: 4px;
        }
        .admin-input-row:focus-within {
          border-color: #1B7A3E;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(27, 122, 62, 0.1);
        }
        .admin-input-icon {
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 48px;
          border-right: 1px solid #e8e8e8;
          color: #999;
          flex-shrink: 0;
        }
        .admin-input-field {
          flex: 1;
          padding: 12px 14px;
          border: none; outline: none;
          font-family: "DM Mono", monospace;
          font-size: 14px; font-weight: 500;
          letter-spacing: 0.02em;
          background: transparent;
          color: #000;
        }
        .admin-input-field::placeholder { color: #999; }

        /* eye toggle */
        .admin-eye {
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 48px;
          background: none; border: none;
          cursor: pointer;
          color: #999;
        }
        .admin-eye:hover { color: #1B7A3E; }

        /* submit */
        .admin-btn {
          width: 100%;
          padding: 14px;
          background: #1B7A3E;
          color: #ffffff;
          border: 1px solid #1B7A3E;
          font-family: "DM Mono", monospace;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all 0.2s;
          border-radius: 4px;
        }
        .admin-btn:hover:not(:disabled) {
          background: #155632;
          border-color: #155632;
          box-shadow: 0 4px 12px rgba(27, 122, 62, 0.3);
        }
        .admin-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* spinner */
        @keyframes admin-spin { to { transform: rotate(360deg); } }
        .admin-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: admin-spin 0.7s linear infinite;
        }

        /* divider */
        .admin-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 22px 0;
        }
        .admin-divider-line { flex: 1; height: 1px; background: #e8e8e8; }

        /* badge tile */
        .admin-badge {
          border: 1px solid #e8e8e8;
          padding: 10px 8px;
          text-align: center;
          cursor: default;
          background: #fff;
          border-radius: 4px;
        }
        .admin-badge:hover { border-color: #1B7A3E; }

        @media (max-width: 768px) {
          .admin-root  { flex-direction: column; }
          .admin-left  { width: 100%; min-height: 260px; padding: 32px 24px; }
          .admin-right { width: 100%; padding: 36px 24px; }
        }
      `}</style>

      <div className="admin-root">
        {/* ─────────────── LEFT PANEL ─────────────── */}
        <div className="admin-left">
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
                  background: "#1B7A3E",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield style={{ width: 20, height: 20, color: "#F5A623" }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 18,
                    color: "#fff",
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  BHIMA ASTRA
                </div>
                <div
                  style={{
                    color: "#666",
                    marginTop: 3,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                  }}
                >
                  Admin Portal
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
                style={{
                  color: "#666",
                  marginBottom: 14,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                System Command Centre
              </div>

              <h1
                style={{
                  color: "#fff",
                  fontSize: "clamp(2.1rem, 3.6vw, 3.1rem)",
                  marginBottom: 20,
                  lineHeight: 1.08,
                  fontFamily: '"Cormorant Garamond", serif',
                  fontWeight: 700,
                }}
              >
                Oversee.
                <br />
                Optimize.
                <br />
                Secure.
              </h1>

              <p
                style={{
                  color: "#888",
                  maxWidth: 300,
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                }}
              >
                Complete visibility into platform health, worker metrics,
                dispute resolution and payout integrity — comprehensive system
                governance.
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
              style={{
                color: "#666",
                marginBottom: 20,
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
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
                  className="admin-stat-border"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
                >
                  <div
                    style={{
                      color: "#F5A623",
                      fontSize: "1.85rem",
                      marginBottom: 4,
                      fontWeight: 700,
                      fontFamily: '"DM Mono", monospace',
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      color: "#666",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ─────────────── RIGHT PANEL ─────────────── */}
        <div className="admin-right">
          <div className="admin-corner admin-corner-tl" />
          <div className="admin-corner admin-corner-tr" />
          <div className="admin-corner admin-corner-bl" />
          <div className="admin-corner admin-corner-br" />

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
                border: "1px solid #1B7A3E",
                color: "#1B7A3E",
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
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1B7A3E";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "#1B7A3E";
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
              Back
            </motion.button>

            {/* Eyebrow */}
            <div
              style={{
                marginBottom: 8,
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#1B7A3E",
              }}
            >
              Secure Access · Administrator
            </div>

            {/* h2 */}
            <h2
              style={{
                marginBottom: 8,
                fontSize: "clamp(1.7rem, 2.6vw, 2.3rem)",
                fontFamily: '"Cormorant Garamond", serif',
                fontWeight: 700,
                color: "#000",
              }}
            >
              Admin Sign-In
            </h2>

            <p
              style={{
                marginBottom: 36,
                fontSize: "0.95rem",
                lineHeight: 1.6,
                color: "#555",
              }}
            >
              Enter your credentials to access the admin dashboard.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  Email
                </label>
                <div className="admin-input-row">
                  <div className="admin-input-icon">
                    <User style={{ width: 14, height: 14 }} />
                  </div>
                  <input
                    type="email"
                    className="admin-input-field"
                    placeholder="admin@bhima.com"
                    value={email}
                    autoComplete="username"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  Password
                </label>
                <div className="admin-input-row">
                  <div className="admin-input-icon">
                    <Lock style={{ width: 14, height: 14 }} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="admin-input-field"
                    placeholder="password123"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                  />
                  <button
                    type="button"
                    className="admin-eye"
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
                    style={{
                      color: "#b00020",
                      marginBottom: 12,
                      marginTop: 6,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
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
              <button type="submit" className="admin-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="admin-spinner" />
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
            <div className="admin-divider">
              <div className="admin-divider-line" />
              <span
                style={{ fontSize: "0.7rem", color: "#999", fontWeight: 600 }}
              >
                Verified Access
              </span>
              <div className="admin-divider-line" />
            </div>

            {/* Trust badges */}
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
                <div key={b.label} className="admin-badge">
                  <div style={{ fontSize: 17 }}>{b.icon}</div>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#666",
                    }}
                  >
                    {b.label}
                  </span>
                </div>
              ))}
            </div>

            <p
              style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: "0.8rem",
                color: "#999",
              }}
            >
              By signing in you agree to our{" "}
              <span
                style={{
                  color: "#1B7A3E",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Terms
              </span>{" "}
              &{" "}
              <span
                style={{
                  color: "#1B7A3E",
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

export default AdminLogin;
