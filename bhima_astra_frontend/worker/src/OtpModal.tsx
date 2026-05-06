import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
}

const OtpModal: React.FC<OtpModalProps> = ({ isOpen, onClose, phone }) => {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setOtp(Array(6).fill(""));
    setTimer(30);
    setCanResend(false);
    setVerified(false);
    setError("");
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
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      setError("");
      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      const newOtp = Array(6).fill("");
      pasted.split("").forEach((ch, i) => { newOtp[i] = ch; });
      setOtp(newOtp);
      const nextEmpty = Math.min(pasted.length, 5);
      inputRefs.current[nextEmpty]?.focus();
    },
    []
  );

  const handleVerify = async () => {
    if (otp.some((d) => !d)) {
      setError("Please enter all 6 digits.");
      return;
    }
    setVerifying(true);
    // Simulated Twilio OTP verification
    await new Promise((r) => setTimeout(r, 1500));
    setVerifying(false);
    setVerified(true);
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setTimer(30);
    setOtp(Array(6).fill(""));
    setError("");
    // Simulate Twilio resend
    await new Promise((r) => setTimeout(r, 500));
    inputRefs.current[0]?.focus();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white border border-black z-10 w-full max-w-sm mx-4 overflow-hidden"
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-black" />

            <div className="p-8">
              {!verified ? (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-black mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <h2
                      className="text-xl font-black tracking-tight text-black"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      Enter OTP
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Sent to <span className="text-black font-semibold">{phone}</span>
                    </p>
                  </div>

                  {/* OTP Inputs */}
                  <div className="flex gap-2 mb-2">
                    {otp.map((digit, i) => (
                      <motion.input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        className={`w-full aspect-square text-center text-xl font-black border-2 outline-none transition-all duration-150
                          ${digit ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"}
                          ${error ? "border-red-500" : ""}
                          focus:border-black`}
                        style={{ fontFamily: "'Courier New', monospace" }}
                        whileFocus={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      />
                    ))}
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        className="text-xs text-red-600 mb-4"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Resend */}
                  <div className="text-xs text-gray-500 mb-6 mt-3">
                    {canResend ? (
                      <button
                        onClick={handleResend}
                        className="underline text-black font-semibold hover:opacity-60 transition-opacity"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span>
                        Resend OTP in{" "}
                        <span className="font-black text-black">{timer}s</span>
                      </span>
                    )}
                  </div>

                  {/* Verify Button */}
                  <motion.button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="w-full py-3 bg-black text-white text-sm font-black tracking-widest uppercase border-2 border-black
                      hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileTap={{ scale: 0.98 }}
                  >
                    {verifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                        />
                        Verifying...
                      </span>
                    ) : (
                      "Verify OTP"
                    )}
                  </motion.button>

                  {/* Cancel */}
                  <button
                    onClick={onClose}
                    className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <motion.div
                  className="text-center py-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    className="w-16 h-16 bg-black flex items-center justify-center mx-auto mb-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.div>
                  <h3
                    className="text-2xl font-black text-black mb-2"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    Verified!
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Identity confirmed. Welcome to the portal.
                  </p>
                  <motion.button
                    onClick={onClose}
                    className="px-8 py-3 bg-black text-white text-sm font-black tracking-widest uppercase border-2 border-black hover:bg-white hover:text-black transition-colors duration-200"
                    whileTap={{ scale: 0.97 }}
                  >
                    Continue
                  </motion.button>
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