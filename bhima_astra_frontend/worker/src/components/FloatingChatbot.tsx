import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatPanel from './ChatPanel';

/* ─── Style helpers ───────────────────────────────── */
const inter = (size = 14, weight = 400): React.CSSProperties => ({
  fontFamily: "'Inter', 'Aestera', system-ui, sans-serif",
  fontSize: size,
  fontWeight: weight,
  lineHeight: 1.6,
});

/* ─── Color tokens ────────────────────────────────── */
const C = {
  bg: '#ffffff',       // card surface
  bgDeep: '#f9fafb',   // deeper bg
  border: '#e5e7eb',   // default border
  borderHover: '#d1d5db',   // hover border
  textPrimary: '#111827',
  textSecond: '#6b7280',
  accent: '#4F46E5',   // indigo
  accentHover: '#4338CA',
};

/* ─── Support option data ────────────────────────── */
const OPTIONS = [
  {
    id: 'livechat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: 'BHIMA BOT',
    sub: 'Chat with support now',
    iconBg: '#1E1B4B',
    iconColor: '#818CF8',
    href: '#',
    isLiveChat: true,

  }
];

/* ─── Chat Icon SVG ──────────────────────────────── */
const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/* ─── Chevron right ──────────────────────────────── */
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ═══════════════════════════════════════════════════
   FLOATING CHATBOT COMPONENT
═══════════════════════════════════════════════════ */
const FloatingChatbot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleOptionClick = (opt: typeof OPTIONS[number]) => {
    if (opt.isLiveChat) {
      setOpen(false);
      setChatOpen(true);
    }
  };

  /* Shared card base */
  const cardBase: React.CSSProperties = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '13px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background 0.18s, border-color 0.18s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        .gs-opt-card:hover { background: #f3f4f6 !important; border-color: #111827 !important; }
        @media (max-width: 768px) {
          .chat-wrapper {
            bottom: 12px !important;
            right: 12px !important;
          }
        }
      `}</style>

      {/* ── Full Chat Panel ───────────────────────── */}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ── Popup Panel ─────────────────────────── */}
      <div
        className="chat-wrapper"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: 290,
            }}
          >
            {/* ── Header card ──────────────────────── */}
            <div style={{
              background: C.bgDeep,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <div>
                <div style={{ ...inter(14, 600), color: C.textPrimary }}>
                  Bhima Astra Support
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#22c55e',
                    flexShrink: 0,
                  }} />
                  <span style={{ ...inter(12), color: C.textSecond }}>
                    We&apos;re online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close support menu"
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#111827',
                  fontSize: 13, transition: 'all 0.15s',
                }}
                onMouseOver={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = C.bg;
                  (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderHover;
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#111827';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                }}
              >
                ✕
              </button>
            </div>

            {/* ── Options ──────────────────────────── */}
            {OPTIONS.map((opt, i) => {
              const inner = (
                <>
                  {/* Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: opt.iconBg,
                    border: `1px solid ${opt.iconBg}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: opt.iconColor,
                  }}>
                    {opt.icon}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...inter(13, 500), color: C.textPrimary }}>
                      {opt.label}
                    </div>
                    <div style={{ ...inter(11), color: C.textSecond, marginTop: 2 }}>
                      {opt.sub}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div style={{ color: '#111827', flexShrink: 0 }}>
                    <ChevronRight />
                  </div>
                </>
              );

              if (opt.isLiveChat) {
                return (
                  <motion.div
                    key={opt.id}
                    className="gs-opt-card"
                    role="button"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.055, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    style={cardBase}
                    onClick={() => handleOptionClick(opt)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleOptionClick(opt); }}
                  >
                    {inner}
                  </motion.div>
                );
              }

              return (
                <motion.a
                  key={opt.id}
                  href={opt.href}
                  className="gs-opt-card"
                  target={opt.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={cardBase}
                >
                  {inner}
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Button ──────────────────────── */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        aria-label="Open support chat"
        style={{
          width: 50, height: 50,
          borderRadius: '50%',
          background: open ? '#374151' : C.accent,
          border: `1px solid ${open ? '#4B5563' : '#4338CA'}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 16, lineHeight: 1, display: 'flex' }}
            >
              ✕
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ opacity: 0, scale: 0.6, rotate: 30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: -30 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex' }}
            >
              <ChatIcon />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      </div>
    </>
  );
};

export default FloatingChatbot;
