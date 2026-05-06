import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Slide data ──────────────────────────────────────────────────────────────────
interface Slide {
  id: number;
  text: string;
  image?: string;
  subtitle?: string;
  isFinal?: boolean;
}

const SLIDES: Slide[] = [
  { id: 0, text: 'We are protecting you from...' },
  { id: 1, text: 'Curfews', image: '/images/curfewsuj.jpg' },
  { id: 2, text: 'Heavy Rain & Floods', image: '/images/FloodSuj.jpg' },
  { id: 3, text: 'Extreme Heat', image: '/images/ExtremeHeatsuj.jpg' },
  { id: 4, text: 'Extreme Climate', image: '/images/Extemeclimatesuj.jpg' },
  { id: 5, text: 'Strikes & Protests', image: '/images/strikessuj.jpg' },
  {
    id: 6,
    text: 'Your family is our family',
    subtitle: 'We protect your income when life gets uncertain',
    image: '/images/Familysuj.jpg',
    isFinal: true
  },
];

// ── Timing (seconds) ───────────────────────────────────────────────────────────
const FADE_IN = 0.6;
const HOLD = 1.4;
const FADE_OUT = 0.6;
// Standard slides: FADE_IN + HOLD
const SLIDE_ADVANCE_MS = (FADE_IN + HOLD) * 1000;

// ── Props ──────────────────────────────────────────────────────────────────────
interface CinematicSlideshowProps {
  onComplete?: () => void;
  /** If true the slideshow loops indefinitely (no onComplete call). */
  loop?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
const CinematicSlideshow: React.FC<CinematicSlideshowProps> = ({
  onComplete,
  loop = false,
}) => {
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advance to the next slide
  useEffect(() => {
    const currentSlide = SLIDES[index];
    const durationMs = currentSlide.isFinal ? 3200 : SLIDE_ADVANCE_MS; // 1.2s fade + 2s hold for final

    timerRef.current = setTimeout(() => {
      const isLast = index === SLIDES.length - 1;

      if (isLast && !loop) {
        // Trigger the exit fade of the last slide, then call onComplete
        setExiting(true);
        // Wait for exit animation to finish before calling onComplete
        setTimeout(() => onComplete?.(), FADE_OUT * 1000);
      } else {
        setIndex((prev) => (prev + 1) % SLIDES.length);
      }
    }, durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, loop, onComplete]);

  if (exiting && !loop) {
    // Render an empty black screen while the final fade-out completes
    return <div className="relative w-full h-full bg-black z-10" />;
  }

  const slide = SLIDES[index];

  return (
    <div
      id="cinematic-slideshow"
      className="relative w-full h-full overflow-hidden"
      style={{ background: '#000000' }}
    >
      {/* ── Slide ─────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_IN, ease: 'easeInOut' }}
        >
          {/* ── Headline ─────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center z-10 relative">
            <motion.h1
              className="text-white text-center font-black tracking-tight select-none"
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: slide.isFinal ? 'clamp(2.5rem, 5vw, 4.5rem)' : 'clamp(1.8rem, 4.5vw, 4rem)',
                lineHeight: 1.15,
                textShadow: '0 2px 40px rgba(0,0,0,0.9)',
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: slide.isFinal ? 1.2 : 0.55, delay: 0.08, ease: 'easeOut' }}
            >
              {slide.text}
            </motion.h1>
            {slide.subtitle && (
              <motion.p
                className="text-gray-300 text-center font-medium select-none mt-4"
                style={{
                  fontFamily: 'var(--ff-mono)',
                  fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
                  textShadow: '0 2px 20px rgba(0,0,0,0.8)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
              >
                {slide.subtitle}
              </motion.p>
            )}
          </div>

          {/* ── Image ────────────────────────────────────────────────────── */}
          {slide.image && (
            <motion.div
              className={`absolute overflow-hidden ${slide.isFinal ? 'inset-0 opacity-40' : 'relative rounded-sm'}`}
              style={slide.isFinal ? {} : {
                width: 'min(680px, 82vw)',
                maxHeight: '52vh',
                zIndex: 0
              }}
              initial={
                slide.isFinal ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 0.96 }
              }
              animate={
                slide.isFinal ? { opacity: 0.4, scale: 1.05 } : { opacity: 1, scale: 1 }
              }
              transition={
                slide.isFinal
                  ? { opacity: { duration: 1.2 }, scale: { duration: 3.2, ease: 'linear' } }
                  : { duration: 0.55, delay: 0.18, ease: 'easeOut' }
              }
            >
              {/* The image itself */}
              <img
                src={slide.image}
                alt={slide.text}
                className="w-full object-cover block"
                style={{
                  height: slide.isFinal ? '100vh' : 'auto',
                  maxHeight: slide.isFinal ? 'none' : '52vh',
                  display: 'block'
                }}
                draggable={false}
              />

              {!slide.isFinal && (
                <>
                  {/* Cinematic letterbox bars */}
                  <div
                    className="absolute inset-x-0 top-0 pointer-events-none"
                    style={{ height: '10%', background: '#000' }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 pointer-events-none"
                    style={{ height: '10%', background: '#000' }}
                  />
                </>
              )}

              {/* Radial vignette (slightly wider for final slide) */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: slide.isFinal
                    ? 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.9) 100%)'
                    : 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)',
                }}
              />

              {/* Subtle horizontal scanline overlay for cinematic feel */}
              {(!slide.isFinal) && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
                  }}
                />
              )}
            </motion.div>
          )}


        </motion.div>
      </AnimatePresence>

      {/* ── Background grain (cinematic texture) ─────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.03,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          zIndex: 1,
        }}
      />


    </div>
  );
};

export default CinematicSlideshow;
