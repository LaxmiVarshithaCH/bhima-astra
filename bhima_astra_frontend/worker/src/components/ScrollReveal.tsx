import React, { useEffect, useRef } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;        // seconds, e.g. 0.1
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Wraps any content with the global blur-fade-up scroll reveal.
 * Uses the shared `.section-reveal` / `.revealed` CSS classes from index.css.
 * Works on Dashboard, Forecast, Policy, Payouts, Plans — never on Login.
 */
const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, delay = 0, style, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          obs.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`section-reveal ${className}`}
      style={{ transitionDelay: delay ? `${delay}s` : undefined, ...style }}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
