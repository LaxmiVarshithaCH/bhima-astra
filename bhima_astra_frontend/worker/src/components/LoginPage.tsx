import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OtpModal from "./OtpModal";
import CinematicSlideshow from "./CinematicSlideshow";
import { sendOtp } from "../services/api";

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpCopied, setOtpCopied] = useState(false);

  const handleSend = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Enter a valid 10-digit phone number.");
      return;
    }
    setPhoneError("");
    setSending(true);
    try {
      const result = await sendOtp(digits);
      if (result.demo_otp) setDemoOtp(result.demo_otp);
      setModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      if (
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("422")
      ) {
        setModalOpen(true);
      } else if (msg.toLowerCase().includes("too many")) {
        setPhoneError("Too many attempts. Please wait before trying again.");
      } else {
        setModalOpen(true);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page-container {
          display: flex;
          height: 100vh;
          width: 100%;
        }
        .login-page-left {
          width: 50%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
        }
        .login-page-right {
          width: 50%;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        @media (max-width: 768px) {
          .login-page-container {
            flex-direction: column;
            height: auto;
            min-height: 100vh;
          }
          .login-page-left, .login-page-right {
            width: 100%;
          }
          .login-page-left {
            height: 50vh;
            min-height: 400px;
          }
          .login-page-right {
            padding: 40px 20px;
            flex: 1;
          }
        }
        .phone-input::placeholder { color: #111827; opacity: 1; }
      `}</style>

      {/* ── Fixed OTP Toast — z-index 10000, always above modal ────────── */}
      <AnimatePresence>
        {demoOtp && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#ffffff",
              border: "1.5px solid #16a34a",
              borderRadius: 12,
              padding: "12px 18px",
              boxShadow:
                "0 8px 32px rgba(22,163,74,0.20), 0 2px 8px rgba(0,0,0,0.12)",
              minWidth: 300,
              maxWidth: "calc(100vw - 32px)",
            }}
          >
            {/* Lock icon */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#dcfce7",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            {/* OTP digits */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--ff-mono)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#16a34a",
                  marginBottom: 3,
                }}
              >
                Demo Mode — Your OTP
              </div>
              <div
                style={{
                  fontFamily: "var(--ff-mono)",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#111827",
                  letterSpacing: "0.45em",
                  lineHeight: 1,
                }}
              >
                {demoOtp}
              </div>
            </div>

            {/* Copy + Dismiss */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flexShrink: 0,
              }}
            >
              <motion.button
                onClick={() => {
                  navigator.clipboard.writeText(demoOtp);
                  setOtpCopied(true);
                  setTimeout(() => setOtpCopied(false), 2000);
                }}
                whileTap={{ scale: 0.93 }}
                style={{
                  padding: "5px 12px",
                  background: otpCopied ? "#16a34a" : "#f0fdf4",
                  border: `1px solid ${otpCopied ? "#16a34a" : "#86efac"}`,
                  borderRadius: 6,
                  color: otpCopied ? "#fff" : "#16a34a",
                  fontFamily: "var(--ff-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {otpCopied ? "Copied" : "Copy"}
              </motion.button>
              <button
                onClick={() => setDemoOtp(null)}
                style={{
                  padding: "4px 8px",
                  background: "transparent",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  color: "#9ca3af",
                  fontFamily: "var(--ff-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#d1d5db";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#6b7280";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#e5e7eb";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#9ca3af";
                }}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Layout ─────────────────────────────────────────────────── */}
      <div className="login-page-container">
        {/* LEFT — cinematic slideshow */}
        <div className="login-page-left">
          <CinematicSlideshow loop={true} />
        </div>

        {/* RIGHT — login form */}
        <div className="login-page-right">
          <motion.div
            style={{ maxWidth: 360, width: "100%" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Go Back */}
            <motion.button
              onClick={() => (window.location.href = "/")}
              style={{
                marginBottom: 24,
                background: "none",
                border: "1px solid #111827",
                color: "#111827",
                padding: "8px 12px",
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontFamily: "var(--ff-mono)",
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#111827";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "none";
                (e.currentTarget as HTMLButtonElement).style.color = "#111827";
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </motion.button>

            <div
              style={{
                fontFamily: "var(--ff-mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#111827",
                marginBottom: 8,
              }}
            >
              Secure Access
            </div>

            <h2
              style={{
                fontFamily: "var(--ff-display)",
                fontSize: "clamp(27px,3.2vw,37px)",
                fontWeight: 700,
                color: "#111827",
                opacity: 1,
                filter: "none",
                marginBottom: 6,
              }}
            >
              Worker Login
            </h2>

            <p
              style={{
                fontSize: 14,
                color: "#111827",
                marginBottom: 32,
                lineHeight: 1.6,
              }}
            >
              Enter your mobile number to receive a one-time password and access
              your insurance portal.
            </p>

            {/* Phone input */}
            <label
              style={{
                fontFamily: "var(--ff-mono)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#000",
                marginBottom: 8,
                display: "block",
              }}
            >
              Phone Number
            </label>
            <div
              style={{
                display: "flex",
                border: "2px solid #000",
                marginBottom: 6,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.1)")
              }
              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderRight: "2px solid #000",
                  background: "#f9f9f9",
                  color: "#000000",
                  fontFamily: "var(--ff-mono)",
                  fontSize: 14,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  userSelect: "none",
                }}
              >
                +91
              </div>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="9493029001"
                className="phone-input"
                value={phone}
                maxLength={10}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  if (phoneError) setPhoneError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  border: "none",
                  outline: "none",
                  fontFamily: "var(--ff-mono)",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  background: "#ffffff",
                  color: "#000000",
                  caretColor: "#000000",
                }}
              />
            </div>

            <AnimatePresence>
              {phoneError && (
                <motion.p
                  style={{
                    fontFamily: "var(--ff-mono)",
                    fontSize: 11,
                    color: "#dc2626",
                    marginBottom: 16,
                  }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {phoneError}
                </motion.p>
              )}
            </AnimatePresence>
            {!phoneError && <div style={{ height: 16 }} />}

            {/* Send OTP button */}
            <motion.button
              onClick={handleSend}
              disabled={sending}
              className="w-full"
              style={{
                padding: "14px",
                background: "#000",
                color: "#fff",
                border: "2px solid #000",
                fontFamily: "var(--ff-mono)",
                fontSize: 13,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                cursor: sending ? "not-allowed" : "pointer",
                opacity: sending ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseOver={(e) => {
                if (!sending) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#fff";
                  (e.currentTarget as HTMLButtonElement).style.color = "#000";
                }
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#000";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              whileTap={{ scale: 0.98 }}
            >
              {sending ? (
                <>
                  <motion.span
                    className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 0.7,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "20px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span
                style={{
                  fontFamily: "var(--ff-mono)",
                  fontSize: 11,
                  color: "#111827",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Protected
              </span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
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
                <div
                  key={b.label}
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "10px 8px",
                    textAlign: "center",
                    cursor: "default",
                    transition: "border-color 0.2s",
                  }}
                  onMouseOver={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.borderColor =
                      "#000")
                  }
                  onMouseOut={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.borderColor =
                      "#e5e7eb")
                  }
                >
                  <div style={{ fontSize: 19 }}>{b.icon}</div>
                  <span
                    style={{
                      fontFamily: "var(--ff-mono)",
                      fontSize: 11,
                      color: "#111827",
                      display: "block",
                      marginTop: 4,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {b.label}
                  </span>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: 12,
                color: "#111827",
                marginTop: 20,
                textAlign: "center",
              }}
            >
              By logging in you agree to our{" "}
              <span style={{ textDecoration: "underline", cursor: "pointer" }}>
                Terms
              </span>{" "}
              &{" "}
              <span style={{ textDecoration: "underline", cursor: "pointer" }}>
                Privacy Policy
              </span>
            </p>
          </motion.div>

          {/* Corner accents */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 48,
              height: 48,
              borderBottom: "1px solid #f3f3f3",
              borderLeft: "1px solid #f3f3f3",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: 48,
              height: 48,
              borderTop: "1px solid #f3f3f3",
              borderRight: "1px solid #f3f3f3",
            }}
          />
        </div>
      </div>

      <OtpModal
        isOpen={modalOpen}
        phone={phone}
        onClose={() => setModalOpen(false)}
        onVerified={() => {
          setModalOpen(false);
          setDemoOtp(null);
          onLogin();
        }}
      />
    </>
  );
};

export default LoginPage;
