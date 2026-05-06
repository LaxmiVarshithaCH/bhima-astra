import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
  { id: 0, text: "We are protecting you from...", image: null },
  { id: 1, text: "Extreme Heat", image: "/images/ExtremeHeatsuj.jpg" },
  { id: 2, text: "Curfew & Lockdown", image: "/images/curfewsuj.jpg" },
  { id: 3, text: "Heavy Rain & Floods", image: "/images/FloodSuj.jpg" },
  { id: 4, text: "Extreme Climate", image: "/images/Extemeclimatesuj.jpg" },
  { id: 5, text: "Strikes & Protests", image: "/images/strikessuj.jpg" }
];

const Slide = ({ index, onComplete }: { index: number; onComplete: () => void }) => {
  useEffect(() => {
    // Fade in (0.6s) + Hold (1.4s) = 2.0s total before triggering next slide.
    // The parent state change unmounts this component, triggering a 0.6s exit animation.
    // Total cycle time per slide will be exactly 2.6s as requested.
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const slide = slides[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full p-8 text-center"
    >
      {slide.id === 0 ? (
        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-tight tracking-tight text-white max-w-4xl px-4">
          {slide.text}
        </h1>
      ) : (
        <div className="flex flex-col items-center justify-center gap-10 md:gap-14 w-full h-full max-w-5xl">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-medium text-white tracking-wide drop-shadow-lg">
            {slide.text}
          </h2>
          {slide.image && (
            <div className="w-full max-w-[90vw] md:max-w-[70vw] lg:max-w-[650px] aspect-[4/3] md:aspect-video rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] bg-black">
              <img
                src={slide.image}
                alt={slide.text}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export const LoginHero: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, []);

  return (
    <div className="w-full h-full min-h-screen bg-black overflow-hidden relative">
      {/* AnimatePresence with mode="wait" ensures only ONE slide exists in the DOM at any given time, creating seamless fade-to-black transitions */}
      <AnimatePresence mode="wait">
        <Slide key={currentIndex} index={currentIndex} onComplete={handleNext} />
      </AnimatePresence>
    </div>
  );
};

export default LoginHero;
