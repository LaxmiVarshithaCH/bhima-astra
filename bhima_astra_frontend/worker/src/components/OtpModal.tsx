import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendOtp, verifyOtp, setToken } from "../services/api";

interface OtpModalProps {
  isOpen: boolean;
  phone: string;
  onClose: () => void;
  onVerified: () => void;
}

const OtpModal: React.FC<OtpModalProps> = ({
  isOpen,
  phone,
  onClose,
  onVerified,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [attempts, setAttempts] = useState<number>(0);
  const [suspended, setSuspended] = useState<boolean>(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setOtp(Array(6).fill(""));
    setTimer(30);
    setCanResend(false);
    setVerified(false);
    setError("");
    setAttempts(0);
    setSuspended(false);
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || canResend) return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, canResend]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, "").slice(-1);
      const next = [...otp];
      next[index] = digit;
      setOtp(next);
      setError("");
      if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    },
    [otp],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !otp[index] && index > 0)
        inputRefs.current[index - 1]?.focus();
    },
    [otp],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    const next = Array(6).fill("");
    pasted.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }, []);

  const handleVerify = async () => {
    if (otp.some((d) => !d)) {
      setError("Please enter all 6 digits.");
      return;
    }
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    if (newAttempts >= 4) {
      setSuspended(true);
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const digits = phone.replace(/\D/g, "");
      const result = await verifyOtp(digits, otp.join(""));
      // Store JWT and worker ID
      setToken(result.access_token);
      localStorage.setItem("bhima_worker_id", String(result.worker_id));
      localStorage.setItem("isLoggedIn", "true");
      setVerified(true);
      setTimeout(() => {
        onVerified();
      }, 1400);
    } catch (err) {
      setVerifying(false);
      const msg = err instanceof Error ? err.message : "Invalid OTP";
      if (
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("expired")
      ) {
        setError("Invalid or expired OTP. Please try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setTimer(30);
    setOtp(Array(6).fill(""));
    setError("");
    // Re-send OTP
    try {
      const digits = phone.replace(/\D/g, "");
      await sendOtp(digits);
    } catch {
      // Silently ignore - OTP printed in backend console
    }
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  if (suspended) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white border-2 border-black w-full mx-4 relative overflow-hidden"
              style={{ maxWidth: 380 }}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div style={{ height: 3, background: "#dc2626" }} />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-7 h-7 border border-gray-300 flex items-center justify-center text-sm hover:bg-black hover:text-white hover:border-black transition-all"
              >
                ✕
              </button>
              <div className="p-8 text-center">
                <div className="w-11 h-11 border-2 border-red-600 flex items-center justify-center mx-auto mb-4 text-xl">
                  🔒
                </div>
                <h3
                  style={{
                    fontFamily: "var(--ff-display)",
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#dc2626",
                    marginBottom: 8,
                  }}
                >
                  Account Suspended
                </h3>
                <p style={{ fontSize: 12, color: "#111827", marginBottom: 20 }}>
                  Too many failed attempts. Please contact support.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-black text-white border-2 border-black hover:bg-white hover:text-black transition-colors"
                  style={{
                    fontFamily: "var(--ff-mono)",
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="w-full mx-4 relative overflow-hidden"
            style={{
              maxWidth: 380,
              background: "#ffffff",
              color: "#111827",
              backdropFilter: "none",
              filter: "none",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              border: "2px solid #111",
            }}
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
          >
            <div style={{ height: 3, background: "#111" }} />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-sm transition-all"
              style={{
                border: "1px solid #d1d5db",
                color: "#111827",
                opacity: 1,
                zIndex: 9999,
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              ✕
            </button>

            <div className="p-8">
              {!verified ? (
                <>
                  <div className="w-11 h-11 border-2 border-black flex items-center justify-center mb-4">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <line
                        x1="12"
                        y1="18"
                        x2="12.01"
                        y2="18"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  <h2
                    style={{
                      fontFamily: "var(--ff-display)",
                      fontSize: 20,
                      fontWeight: 900,
                      marginBottom: 4,
                    }}
                  >
                    Enter OTP
                  </h2>
                  <p
                    style={{ fontSize: 12, color: "#111827", marginBottom: 24 }}
                  >
                    Sent to{" "}
                    <strong style={{ color: "#000" }}>+91 {phone}</strong> via
                    SMS
                  </p>

                  {/* OTP Boxes */}
                  <div className="flex justify-center gap-3 mb-4">
                    {otp.map((digit, i) => (
                      <motion.input
                        key={i}
                        ref={(el) => {
                          inputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        className="text-center text-2xl font-bold outline-none transition-all duration-150"
                        style={{
                          width: "48px",
                          height: "56px",
                          fontFamily: "var(--ff-mono)",
                          border: error
                            ? "2px solid #dc2626"
                            : "2px solid #111111",
                          background: "#ffffff",
                          color: "#000000",
                          fontWeight: 600,
                          borderRadius: "6px",
                        }}
                        whileFocus={{
                          scale: 1.05,
                          borderColor: "#000",
                          boxShadow: "0 0 0 1px #000",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                        }}
                      />
                    ))}
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        style={{
                          fontFamily: "var(--ff-mono)",
                          fontSize: 10,
                          color: "#dc2626",
                          letterSpacing: "0.05em",
                          marginBottom: 8,
                        }}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div
                    style={{
                      fontFamily: "var(--ff-mono)",
                      fontSize: 11,
                      color: "#111827",
                      marginBottom: 20,
                      marginTop: 8,
                    }}
                  >
                    {canResend ? (
                      <button
                        onClick={handleResend}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "var(--ff-mono)",
                          fontSize: 11,
                          color: "#000",
                          textDecoration: "underline",
                        }}
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span>
                        Resend OTP in{" "}
                        <strong style={{ color: "#000" }}>{timer}s</strong>
                      </span>
                    )}
                  </div>

                  <motion.button
                    onClick={handleVerify}
                    disabled={verifying}
                    style={{
                      width: "100%",
                      padding: "12px 0",
                      background: "#000000",
                      color: "#ffffff",
                      fontFamily: "var(--ff-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      opacity: 1,
                      filter: "none",
                      border: "none",
                      cursor: verifying ? "not-allowed" : "pointer",
                      zIndex: 9999,
                      position: "relative",
                    }}
                    onMouseOver={(e) => {
                      if (!verifying)
                        e.currentTarget.style.background = "#111111";
                    }}
                    onMouseOut={(e) => {
                      if (!verifying)
                        e.currentTarget.style.background = "#000000";
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {verifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 0.7,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                        Verifying...
                      </span>
                    ) : (
                      "Verify OTP"
                    )}
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-black transition-colors"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--ff-mono)",
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <motion.div
                  className="text-center py-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <motion.div
                    className="w-16 h-16 bg-black flex items-center justify-center mx-auto mb-4 pop-in"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.div>
                  <h3
                    style={{
                      fontFamily: "var(--ff-display)",
                      fontSize: 22,
                      fontWeight: 900,
                      marginBottom: 6,
                    }}
                  >
                    Verified!
                  </h3>
                  <p style={{ fontSize: 12, color: "#111827" }}>
                    Redirecting to your portal...
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OtpModal;
