import { motion, AnimatePresence } from 'framer-motion';

interface TriggerAlertBannerProps {
  visible: boolean;
  headline: string;
  subline: string;
}

export function TriggerAlertBanner({ visible, headline, subline }: TriggerAlertBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pipeline-section"
          style={{ paddingTop: 0, paddingBottom: 12 }}
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            style={{
              maxWidth: 1440,
              margin: '0 auto',
              paddingLeft: 32,
              paddingRight: 32,
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              boxShadow: '0 0 28px rgba(255,255,255,0.06), inset 0 0 24px rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)'
            }}
            animate={{
              boxShadow: [
                '0 0 28px rgba(255,255,255,0.06), inset 0 0 24px rgba(255,255,255,0.03)',
                '0 0 40px rgba(255,255,255,0.1), inset 0 0 28px rgba(255,255,255,0.05)',
                '0 0 28px rgba(255,255,255,0.06), inset 0 0 24px rgba(255,255,255,0.03)'
              ]
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div style={{ padding: '14px 20px' }}>
              <motion.div
                className="section-eyebrow"
                style={{ marginBottom: 8, color: 'rgba(255,255,255,0.45)' }}
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Trigger Agent
              </motion.div>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.92)',
                  marginBottom: 6
                }}
              >
                {headline}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>{subline}</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
